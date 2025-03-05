// #region IMPORT
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { resolveMediaUrl } from "@/lib/utils";
import {
  EMPTY_VIDEO_COMPOSITION,
  useProject,
  useVideoComposition,
  VideoCompositionData,
} from "@/data/queries";
import { fal } from "@/lib/fal";
import { Button } from "./ui/button";
import { useProjectId, useVideoProjectStore } from "@/data/store";
import { LoadingIcon } from "./ui/icons";
import {
  CopyIcon,
  DownloadIcon,
  Share2Icon as ShareIcon,
  FilmIcon,
} from "lucide-react";
import { Input } from "./ui/input";
import type { ShareVideoParams } from "@/lib/share";
import {
  PROJECT_PLACEHOLDER,
  VideoKeyFrame,
  VideoProject,
} from "@/data/schema";
import { useRouter } from "next/navigation";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { object } from "zod";
// #endregion

// #region TYPES
type ExportDialogProps = {
  project: VideoProject | null;
  supabase: SupabaseClient;
  user: User | null;
  newExport: boolean;
  setNewExport: Dispatch<SetStateAction<boolean>>;
} & Parameters<typeof Dialog>[0];

type ShareResult = {
  video_url: string;
  thumbnail_url: string;
};
// #endregion

// #region MAIN
export function ExportDialog({
  onOpenChange,
  project,
  supabase,
  user,
  newExport,
  setNewExport,
  ...props
}: ExportDialogProps) {
  // #region Const & States
  if (!project) {
    project = PROJECT_PLACEHOLDER;
  }
  /* const { data: composition = EMPTY_VIDEO_COMPOSITION } =
    useVideoComposition(project.id); */

  const [isCompositionLoading, setIsCompositionLoading] =
    useState<boolean>(false);
  const [composition, setComposition] = useState<VideoCompositionData>(
    EMPTY_VIDEO_COMPOSITION,
  );
  const router = useRouter();

  // #region Get Composition
  useEffect(() => {
    const getComposition = async () => {
      if (!project || !user) return;

      setIsCompositionLoading(true);
      try {
        const { data: tracks, error: errorTracks } = await supabase
          .from("projects_assets")
          .select(`
            *, 
            keyframes(
              *,
              assets(*)
            )
          `)
          .eq("project_id", project.id);

        if (errorTracks) {
          console.log("Error getting composition: ", errorTracks);
          throw errorTracks;
        }

        const processed = tracks.reduce<VideoCompositionData>(
          (acc, track) => {
            const { keyframes, ...trackWithoutKeyframes } = track;
            acc.tracks.push(trackWithoutKeyframes);

            const sortedKeyframes = keyframes?.sort(
              (a: any, b: any) => a.timestamp - b.timestamp,
            );
            let frameIndex = Object.keys(acc.frames).length;

            sortedKeyframes?.forEach((keyframe: any) => {
              const { assets, ...frameWithoutAssets } = keyframe;
              acc.frames[frameIndex] = frameWithoutAssets;
              frameIndex++;

              if (assets) {
                const assetsArray = Array.isArray(assets) ? assets : [assets];
                assetsArray.forEach((asset) => {
                  acc.mediaItems[asset.id] = asset;
                });
              }
            });

            return acc;
          },
          { tracks: [], frames: {}, mediaItems: {} },
        );

        setComposition(processed);
      } catch (error) {
        console.error("Error in getComposition: ", error);
        toast({
          title: "Error!",
          description: "An unexpected error occurred. Please try again.",
        });
      } finally {
        setIsCompositionLoading(false);
      }
    };

    if (newExport && project && project !== PROJECT_PLACEHOLDER) {
      getComposition();
    }
    setNewExport(false);
  }, [newExport]);
  // #endregion

  // #region Export Video
  const exportVideo = useMutation({
    mutationFn: async () => {
      if (!user || !project) return;

      console.log("1.0 Empezamos")
      // #region build object
      console.log("1.1 Creando videoData")
      const videoData = composition.tracks.map((track) => {
        const frames = Object.values(composition.frames).filter(
          //@ts-ignore
          (frame) => frame.track_id === track.id,
        );
        return {
          id: track.id,
          type: track.type === "video" ? "video" : "audio",
          keyframes: frames.map((frame) => ({
            //@ts-ignore
            timestamp: frame.timestamp,
            //@ts-ignore
            duration: frame.duration,
            //@ts-ignore
            url: frame.url,
            //@ts-ignore
            type: frame.type,
          })),
        };
      });
      console.log("1.2 videoData: ", videoData);
      // #endregion

      // #region decompose image and videos
      console.log("2.0 Separar videoData");
      const separateKeyframesByType = (data: any) => {
        const imageKeyframes: any = [];
        const videoKeyframes: any = [];

        // Recorrer todas las pistas de tipo video
        console.log("2.1 Separando")
        data.forEach((track: any) => {
          if (track.type === "video") {
            // Recorrer todos los keyframes de esta pista
            track.keyframes.forEach((keyframe: any) => {
              // Clasificar por tipo
              if (keyframe.type === "video") {
                videoKeyframes.push({
                  timestamp: keyframe.timestamp,
                  duration: keyframe.duration,
                  url: keyframe.url,
                  type: "video",
                });
              } else {
                // Por defecto, asumimos que es de tipo "image" si no es "video"
                imageKeyframes.push({
                  timestamp: keyframe.timestamp,
                  duration: keyframe.duration,
                  url: keyframe.url,
                  type: "image",
                });
              }
            });
          }
        });

        console.log("2.2 Regresando Objeto separado")
        return {
          imageKeyframes,
          videoKeyframes,
        };
      };

      // Separar los keyframes por tipo
      const { imageKeyframes, videoKeyframes } =
        separateKeyframesByType(videoData);
      let imageCompose: any;
      console.log("2.3 Image Keyframes:", imageKeyframes);
      console.log("2.4 Video Keyframes:", videoKeyframes);
      console.log("2.5 Project info: ", project);
      // #endregion

      // #region merge images into vidoe
      // Process images with Rendi compose
      if (imageKeyframes.length > 0) {
        console.log("3.0 Empezando Rendi process")
        try {
          // Sort Images and get info
          console.log("3.1 Organizando keyframes")
          const sortedImageKeyframes = [...imageKeyframes].sort(
            (a, b) => a.timestamp - b.timestamp,
          );
          const input_files: any = {};
          const input_durations: any = [];

          console.log("3.2 obteniendo keyframes info")
          // Get track id
          const videoTrack = videoData.find(
            (track) =>
              track.type === "video" &&
              track.keyframes.some((keyframe) => keyframe.type === "image"),
          );
          const track_id = videoTrack ? videoTrack.id : "";
          console.log("3.3 Track_id: ", track_id)

          // Get lowest keyframe and full duration
          const minTimestamp =
            sortedImageKeyframes.length > 0
              ? sortedImageKeyframes[0].timestamp
              : 0;
          const totalDuration = sortedImageKeyframes.reduce(
            (sum, frame) => sum + frame.duration,
            0,
          );
          console.log("3.4 minTimestamp: ", minTimestamp);
          console.log("3.5 totalDuration: ", totalDuration);

          // build ffmpeg command
          console.log("3.6 Crando comando ffmpeg");
          sortedImageKeyframes.forEach((frame, index) => {
            const key = `in_img_${index + 1}`;
            input_files[key] = frame.url;
            input_durations.push(frame.duration / 1000); // Convertir ms a segundos
          });

          // Part 1: Define images entrance
          let ffmpegCommand = "";
          sortedImageKeyframes.forEach((frame, index) => {
            ffmpegCommand += `-loop 1 -t ${input_durations[index]} -i {{in_img_${index + 1}}} `;
          });

          // Part 2: filter commands, scales and padding, concatenate all images
          ffmpegCommand += '-filter_complex "';
          for (let i = 0; i < sortedImageKeyframes.length; i++) {
            ffmpegCommand += `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];`;
          }
          ffmpegCommand += `[${sortedImageKeyframes.map((_, i) => `v${i}`).join("][")}]concat=n=${sortedImageKeyframes.length}:v=1:a=0,format=yuv420p[v]" `;

          // Part 3: Map and codex
          ffmpegCommand += `-map [v] -c:v libx264 {{out_1}}`;
          console.log("3.7 Comando ffmpeg creado: ", ffmpegCommand);

          // Define output
          console.log("3.8 Creando output name")
          const sanitizedTitle = project.title
            ? project.title.replace(/\s+/g, "_")
            : project.id;
          const output_files = {
            out_1: `${sanitizedTitle}_slideshow.mp4`,
          };
          console.log("3.9 outputname creado", output_files)

          console.log("3.10 Creando Playload")
          // Payload and API
          const payload = {
            input_files,
            output_files,
            ffmpeg_command: ffmpegCommand,
          };
          console.log("3.11 Rendi API Payload:", payload);

          console.log("3.12 Llamando api de rendi via deno")
          const rendiResponse = await fetch(
            "https://rendi-deno-post.deno.dev",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            },
          );

          if (!rendiResponse.ok) {
            throw new Error(
              `API de Rendi respondió con estado: ${rendiResponse.status}`,
            );
          }
          const rendiData = await rendiResponse.json();
          console.log("3.14 Respuesta api de rendi: ", rendiData);

          console.log("3.15 creando row de merge en supabase")
          // Supabase insert
          const { data: newData, error: newError } = await supabase
            .from("images_to_video")
            .insert([
              {
                id: rendiData.command_id,
                track_id: track_id,
                timestamp: minTimestamp,
                duration: totalDuration,
              },
            ])
            .select()
            .single();

          if (newError) {
            console.error("Error insertando en Supabase:", newError);
            throw newError;
          }
          console.log("3.16 Nuevo row con id creado: ", newData.id);

          console.log("3.17 Obteniendo url de video merge image")
          // Get url
          const rendiStatusResponse = await fetch(
            `https://rendi-deno-get.deno.dev?command_id=${newData.id}`,
            {
              method: "GET",
              headers: {
                "X-API-KEY":
                  "eJyzNDVJS0w0t3dA1TzNM0zUxNDDXtbBMttRNNk61TDMxNk1LSkyNrygJKCvyMvZzrzKNdPMOsMz3tHSMSgcA7YoRZw==",
              },
            },
          );

          if (!rendiStatusResponse.ok) {
            throw new Error(
              `Error al consultar estado: ${rendiStatusResponse.status}`,
            );
          }
          const statusData = await rendiStatusResponse.json();
          console.log("3.18 respuesta de obtencion de url: ", statusData);

          console.log("3.19 Insertando url a row previeamente creada")
          const { data: updateData, error: updateError } = await supabase
            .from("images_to_video")
            .update({
              url: statusData.output_files.out_1.storage_url,
            })
            .eq("id", newData.id)
            .select("track_id, timestamp, duration, url")
            .single();

          if (updateError) {
            console.log("Error updating data: ", updateError);
            throw updateError;
          }
          console.log("3.20 url insertado: ", updateData)

          console.log("3.21 Agregando data a imageCompose")
          imageCompose = updateData;
        } catch (error) {
          console.error("Error al procesar imágenes con Rendi API:", error);
        }
        console.log("3.22 imageCompose data: ", imageCompose)
      }
      // #endregion

      console.log("3.0.1 Si imageCompose es vacio, saltaste todo el paso 3 (Verifica que no sea un error), imageCompose: ", imageCompose)
      // #region update videoData
      console.log("4.0 Inicaciando nuevo Video data")
      let newVideoData: any = [];
      if (imageCompose) {
        console.log("4.1.0 Modificando videoData")
        newVideoData = videoData.map((track) => {
          if (track.id === imageCompose.track_id) {
            console.log("4.1.1 Obteniendo solo videos del track")
            const videoOnlyKeyframes = track.keyframes.filter(
              (kf) => kf.type === "video",
            );

            console.log("4.1.2 Creando nuevo asset")
            const imageVideoKeyframe = {
              timestamp: imageCompose.timestamp,
              duration: imageCompose.duration,
              url: imageCompose.url,
              type: "video",
            };
            console.log("4.1.3 Nuevo asset: ", imageKeyframes)

            console.log("4.1.4 Creando nuevo track")
            const newKeyframes = [
              ...videoOnlyKeyframes,
              imageVideoKeyframe,
            ].sort((a, b) => a.timestamp - b.timestamp);
            console.log("4.1.4 Nuevo track: ", newKeyframes)

            console.log("4.1.5 Regresando datos")
            return {
              ...track,
              keyframes: newKeyframes,
            };
          }
          console.log("4.1.6 Regresando datos parte 2")
          return track;
        });
        console.log("4.1.7 newVideoData con imageCompose: ", newVideoData)
      } else {
        console.log("4.2.0 Reasiganado videoData")
        newVideoData = videoData;
        console.log("4.2.1 videoData en newVideoData: ", newVideoData)
      }
      // #endregion

      // #region ffmepg api compose
      console.log("5.0 Empezando llamado a fal");
      if (newVideoData.length === 0) {
        throw new Error("No tracks to export");
      }

      console.log("5.1 llamando al api de con newMetaData como input")
      const { data } = await fal.subscribe("fal-ai/ffmpeg-api/compose", {
        input: {
          tracks: newVideoData,
        },
        mode: "polling",
        pollInterval: 3000,
      });

      if (!data.ok) {
        throw new Error("No video or thumbnail URL returned from the service");
      }

      console.log("5.2 data regresada de fal", data);

      console.log("5.3 Creando Blobs de video y url")
      const videoResponse = await fetch(data.video_url);
      const thumbnailResponse = await fetch(data.thumbnail_url);
      console.log("5.4 Blobs creados")

      if (!videoResponse.ok || !thumbnailResponse.ok) {
        throw new Error("Failed to download video or thumbnail");
      }

      console.log("5.5 Asisgnando Blobs")
      const videoBlob = await videoResponse.blob();
      const thumbnailBlob = await thumbnailResponse.blob();
      console.log("5.6 videoBlob asignado y creado: ", videoBlob)
      console.log("5.7 thumbnailBlob asignado y creado: ", thumbnailBlob)
      // #endregion

      // #region insert supabase
      console.log("6.0 creando info para insertar en suoabase")
      const assetId = crypto.randomUUID();
      const videoFilePath = `${user.id}/${project.id}/${assetId}.mp4`;
      const thumbnailFilePath = `${user.id}/${project.id}/${assetId}.jpg`;
      console.log("6.1 Info crada con id: ", assetId)
      console.log("6.2 videoFilePath", videoFilePath)
      console.log("6.3 thumbnailFilePath", thumbnailFilePath)

      console.log("6.4.0 Insertando video a storage supabse")
      const { error: videoStorageErr } = await supabase.storage
        .from("videos")
        .upload(videoFilePath, videoBlob, {
          cacheControl: "3600",
          upsert: false,
        });

      if (videoStorageErr) {
        console.warn(`Error uploading file: ${videoStorageErr.message}`);
        throw new Error("Failed to upload video to storage");
      }

      console.log("6.4.1 Insertando thumbnail a storage supabse")
      const { error: thumbnailStroageErr } = await supabase.storage
        .from("thumbnails")
        .upload(thumbnailFilePath, thumbnailBlob, {
          cacheControl: "3600",
          upsert: false,
        });

      if (thumbnailStroageErr) {
        console.warn(`Error uploading file: ${thumbnailStroageErr.message}`);
        throw new Error("Failed to upload thumnail to storage");
      }

      console.log("6.5 Insertando row a exports tabla")
      const { data: exportInsert, error: exportError } = await supabase
        .from("exports")
        .insert([
          {
            id: assetId,
            user_id: user.id,
            project_id: project.id,
            video_path: videoFilePath,
            thumbnail_path: thumbnailFilePath,
          },
        ])
        .select();

      if (exportError) {
        console.warn(`Error inserting in database: ${exportError.message}`);
        throw new Error("Failed to insert export record");
      }
      console.log("6.6 Data insertad correctamente supabase: ", exportInsert)
      // #endregion

      // #region Create ShareResult
      console.log("6.7 creando finalData a regresar")
      const finalData: ShareResult = {
        video_url: `${process.env.NEXT_PUBLIC__SUPABASE_URL}/storage/v1/object/public/videos/${videoFilePath}`,
        thumbnail_url: `${process.env.NEXT_PUBLIC__SUPABASE_URL}/storage/v1/object/thumbnails/${thumbnailFilePath}`,        
      }
      console.log("6.8 FinalData: ", finalData);
      // #endregion

      return finalData as ShareResult;
    },
  });
  // #endregion

  // #region Modal Controls
  const setExportDialogOpen = useVideoProjectStore(
    (s) => s.setExportDialogOpen,
  );
  const handleOnOpenChange = (open: boolean) => {
    setExportDialogOpen(open);
    onOpenChange?.(open);
  };
  // #endregion

  // #region Share
  const share = useMutation({
    mutationFn: async () => {
      if (!exportVideo.data) {
        throw new Error("No video to share");
      }
      const videoInfo = exportVideo.data;
      const response = await fetch("/api/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: project.title,
          description: project.description ?? "",
          videoUrl: videoInfo.video_url,
          thumbnailUrl: videoInfo.thumbnail_url,
          createdAt: Date.now(),
          // TODO parametrize this
          width: 1920,
          height: 1080,
        } satisfies ShareVideoParams),
      });
      if (!response.ok) {
        throw new Error("Failed to share video");
      }
      return response.json();
    },
  });

  const handleOnShare = async () => {
    const { id } = await share.mutateAsync();
    router.push(`/share/${id}`);
  };
  // #endregion

  const actionsDisabled = exportVideo.isPending || share.isPending;

  // #region JSX Main
  return (
    <Dialog onOpenChange={handleOnOpenChange} {...props}>
      <DialogContent className="sm:max-w-4xl max-w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilmIcon className="w-6 h-6 opacity-50" />
            Export video
          </DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <div className="text-muted-foreground">
          <p>This may take a while, sit back and relax.</p>
        </div>
        <div>
          {exportVideo.isPending || exportVideo.data === undefined ? (
            <div className="aspect-video bg-accent/30 flex flex-col items-center justify-center">
              {exportVideo.isPending ? (
                <LoadingIcon className="w-24 h-24" />
              ) : (
                <FilmIcon className="w-24 h-24 opacity-50" />
              )}
            </div>
          ) : (
            <video
              src={exportVideo.data.video_url}
              controls
              className="w-full h-full"
            />
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-row gap-2 items-center">
            <Input
              value={exportVideo.data?.video_url ?? ""}
              placeholder="Video URL..."
              readOnly
              className="text-muted-foreground"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                navigator.clipboard.writeText(exportVideo.data?.video_url ?? "")
              }
              disabled={exportVideo.data === undefined}
            >
              <CopyIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleOnShare}
            variant="secondary"
            disabled={actionsDisabled || !exportVideo.data}
          >
            <ShareIcon className="w-4 h-4 opacity-50" />
            Share
          </Button>
          <Button
            variant="secondary"
            disabled={actionsDisabled || !exportVideo.data}
            aria-disabled={actionsDisabled || !exportVideo.data}
            asChild
          >
            <a href={exportVideo.data?.video_url ?? "#"} download>
              <DownloadIcon className="w-4 h-4" />
              Download
            </a>
          </Button>
          <Button
            onClick={() => exportVideo.mutate()}
            disabled={actionsDisabled}
          >
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  //#endregion
}
//#endregion
