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

export function ExportDialog({
  onOpenChange,
  project,
  supabase,
  user,
  newExport,
  setNewExport,
  ...props
}: ExportDialogProps) {
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

  const exportVideo = useMutation({
    mutationFn: async () => {
      if (!user || !project) return;

      const mediaItems = composition.mediaItems;
      const videoData = composition.tracks.map((track) => {
        const frames = Object.values(composition.frames).filter(
          //@ts-ignore
          (frame) => frame.track_id === track.id,
        );
        return {
          id: track.id,
          type: track.type === "video" ? "video" : "audio",
          keyframes: frames.map((frame) => ({
            timestamp: frame.timestamp,
            duration: frame.duration,
            url: frame.url,
          })),
        };
      });
      console.log("videoData: ", videoData);
      return

      if (videoData.length === 0) {
        throw new Error("No tracks to export");
      }
      const { data } = await fal.subscribe("fal-ai/ffmpeg-api/compose", {
        input: {
          tracks: videoData,
        },
        mode: "polling",
        pollInterval: 3000,
      });

      if (!data.video_url || !data.thumbnail_url) {
        throw new Error("No video or thumbnail URL returned from the service");
      }

      const videoResponse = await fetch(data.video_url);
      const thumbnailResponse = await fetch(data.thumbnail_url);

      if (!videoResponse.ok || !thumbnailResponse.ok) {
        throw new Error("Failed to download video or thumbnail");
      }

      const videoBlob = await videoResponse.blob();
      const thumbnailBlob = await thumbnailResponse.blob();

      const assetId = crypto.randomUUID();
      const videoFilePath = `${user.id}${assetId}.mp4`;
      const thumbnailFilePath = `${user.id}/${assetId}.jpg`;

      const { error: videoStorageErr } =
        await supabase.storage
          .from("videos")
          .upload(videoFilePath, videoBlob, {
            cacheControl: "3600",
            upsert: false,
          });

      if (videoStorageErr) {
        console.warn(`Error uploading file: ${videoStorageErr.message}`);
        throw new Error("Failed to upload video to storage");
      }

      const { error: thumbnailStroageErr } =
        await supabase.storage
          .from("thumbnails")
          .upload(thumbnailFilePath, thumbnailBlob, {
            cacheControl: "3600",
            upsert: false,
          });

      if (thumbnailStroageErr) {
        console.warn(`Error uploading file: ${thumbnailStroageErr.message}`);
        throw new Error("Failed to upload thumnail to storage");
      }

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

      return data as ShareResult;
    },
  });

  const setExportDialogOpen = useVideoProjectStore(
    (s) => s.setExportDialogOpen,
  );
  const handleOnOpenChange = (open: boolean) => {
    setExportDialogOpen(open);
    onOpenChange?.(open);
  };

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

  const actionsDisabled = exportVideo.isPending || share.isPending;

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
}
