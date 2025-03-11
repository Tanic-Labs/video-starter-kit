"use client";

// #region IMPORTS
import { SupabaseClient, User } from "@supabase/supabase-js";
import {
  AspectRatio,
  type MediaItem,
  PROJECT_PLACEHOLDER,
  VideoProject,
} from "@/data/schema";
import { useVideoProjectStore } from "@/data/store";
import {
  ChevronDown,
  FilmIcon,
  FolderOpenIcon,
  GalleryVerticalIcon,
  ImageIcon,
  ImagePlusIcon,
  ListPlusIcon,
  MicIcon,
  MusicIcon,
  LoaderCircleIcon,
  CloudUploadIcon,
  SparklesIcon,
} from "lucide-react";
import { MediaItemPanel } from "./media-panel";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useState, useEffect, Dispatch, SetStateAction } from "react";
import { toast } from "@/hooks/use-toast";
import { fal } from "@/lib/fal";
import { AspectRatioSelector } from "./aspect-ratio";
// #endregion

// #region TYPES
type LeftPanelProps = {
  supabase: SupabaseClient;
  user: User | null;
  mediaItems: MediaItem[];
  isLoading: boolean;
  fetchData: () => Promise<void>;
  setSelectedMedia: Dispatch<SetStateAction<MediaItem | null>>;
  project: VideoProject | null;
  ratio: AspectRatio | null;
  setRatio: Dispatch<SetStateAction<AspectRatio | null>>;
};
// #endregion

// #region DEBOUNCE
function useDebounce(value: string, delay: number) {
  const [debounceValue, setDebounceValue] = useState<string>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounceValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounceValue;
}
// #endregion

// #region MAIN
export default function LeftPanel({
  supabase,
  user,
  mediaItems,
  isLoading,
  fetchData,
  setSelectedMedia,
  project,
  ratio,
  setRatio,
}: LeftPanelProps) {
  // #region States and Effects
  if (!project) {
    project = PROJECT_PLACEHOLDER;
  }
  const [mediaType, setMediaType] = useState("all");
  const [isUploading, setIsUploading] = useState(false);
  const [title, setNewTitle] = useState(project.title);
  const [description, setNewDescription] = useState(project.description);
  const [showRatio, setShowRatio] = useState<boolean>(false);

  useEffect(() => {
    setNewTitle(project.title);
    setNewDescription(project.description);
  }, [project]);

  const deboounceTitle = useDebounce(title, 1000);
  const debounceDescription = useDebounce(description, 1000);

  const setProjectDialogOpen = useVideoProjectStore(
    (s) => s.setProjectDialogOpen,
  );
  const openGenerateDialog = useVideoProjectStore((s) => s.openGenerateDialog);
  // #endregion

  // #region Upload Assets
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    setIsUploading(true);

    try {
      //#region upload file to bucker
      const file = files[0]; // One file by time (can be updated)
      const fileExt = file.name.split(".").pop();
      const assetId = crypto.randomUUID();
      const mediaType = file.type.split("/")[0];

      const filePath = `${user.id}/${mediaType}s/${assetId}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.warn(`Error al subir archivo: ${error.message}`);
        toast({
          title: "Failed to upload file",
          description: "Please try again",
        });
        return;
      }
      // #endregion

      // #region create asset in table
      let assetMetadata = {
        name: "",
        size: file.size,
        type: file.type,
        description: "",
        orignalName: file.name,
      };

      // Insert the initial asset record
      const { data: assetData, error: assetError } = await supabase
        .from("assets")
        .insert([
          {
            id: assetId,
            user_id: user.id,
            type: mediaType,
            source_type: "uploaded",
            file_path: filePath,
            metadata: assetMetadata,
          },
        ])
        .select()
        .single();

      if (assetError) {
        console.error(
          "Error al insertar en la tabla assets:",
          assetError.message,
        );
        // #endregion
      } else {
        // #region audio management
        // Check file type and process accordingly
        if (mediaType === "audio" || mediaType === "voiceover") {
          const { data: waveformInfo = [] } = await fal.subscribe(
            "fal-ai/ffmpeg-api/waveform",
            {
              input: {
                media_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${filePath}`,
                points_per_second: 5,
                precision: 3,
              },
            },
          );

          if (!waveformInfo) {
            throw new Error("Waveform Inf is no available");
          }

          const { data: waveformInsert, error: waveformError } = await supabase
            .from("assets")
            .update({
              metadata: {
                ...assetData.metadata,
                waveform: waveformInfo.waveform,
                duration: waveformInfo.duration,
              },
            })
            .eq("id", assetData.id)
            .select();

          if (waveformError) {
            console.log(waveformError);
            throw waveformError;
          }
          // #endregion
        } else if (mediaType === "video") {
          // #region video managemente (get metadata)
          // Process video metadata
          const { data: mediaMetadata = [] } = await fal.subscribe(
            "fal-ai/ffmpeg-api/metadata",
            {
              input: {
                media_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${filePath}`,
                extract_frames: true,
              },
              mode: "streaming",
            },
          );

          if (!mediaMetadata.media) {
            throw new Error("Media metadata is not available");
          }

          console.log("1.2 Metadata obteneida: ", mediaMetadata);
          //#endregion

          // #region video managemente (get audio)
          const outputName = `${assetId}_audio`;
          const extractResponse = await fetch(
            `https://api.apyhub.com/extract/video/audio/url?output=${outputName}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apy-token": `${process.env.NEXT_PUBLIC_APYHUB_API_KEY}`,
              },
              body: JSON.stringify({
                video_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${filePath}`,
                start_time: "0",
                duration: `${Math.round(mediaMetadata.media.duration)}`,
                output_format: "mp3",
              }),
            },
          );

          if (!extractResponse.ok) {
            throw new Error(
              `Error extracting audio: ${extractResponse.statusText}`,
            );
          }

          const extractData = await extractResponse.json();
          const audioUrl = extractData.data;

          // Download the extracted audio as blob
          const audioResponse = await fetch(audioUrl);
          if (!audioResponse.ok) {
            throw new Error("Failed to download extracted audio");
          }

          const audioArrayBuffer = await audioResponse.arrayBuffer();
          const audioBlob = new Blob([audioArrayBuffer], { type: "audio/mp3" });

          const audioFilePath = `${user.id}/audios/${assetId}_audio.mp3`;

          const { data: audioData, error: audioUploadError } =
            await supabase.storage
              .from("assets")
              .upload(audioFilePath, audioBlob, {
                cacheControl: "3600",
                upsert: false,
                contentType: "audio/mp3",
              });

          if (audioUploadError) {
            console.warn(
              `Error al subir audio extraído: ${audioUploadError.message}`,
            );
            throw audioUploadError;
          }
          //#endregion

          // #region video managemente (update asset)
          const audioPublicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${audioFilePath}`;

          const { data: videoUpdate, error: videoUpdateError } = await supabase
            .from("assets")
            .update({
              metadata: {
                ...assetData.metadata,
                duration: mediaMetadata.media.duration,
                start_frame_url: mediaMetadata.media.start_frame_url,
                end_frame_url: mediaMetadata.media.end_frame_url,
                video_audio_path: audioFilePath,
                video_audio_url: audioPublicUrl,
              },
            })
            .eq("id", assetData.id)
            .select();

          if (videoUpdateError) {
            console.log(videoUpdateError);
            throw videoUpdateError;
          }
          // #endregion
        }

        // Refresh data and reset upload state
        fetchData();
        setIsUploading(false);
      }
    } catch (err) {
      console.warn(`ERROR! ${err}`);
      toast({
        title: "Failed to upload file",
        description: "Please try again",
      });
      setIsUploading(false);
    }
  };
  //#endregion

  // #region Update Projects
  const handleUpdateProject = async (updates: {
    title?: string;
    description?: string;
  }) => {
    if (!project.id || !user) {
      toast({
        title: "Cannot update project",
        description: "Project or user not found",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("projects")
        .update({
          title: updates.title,
          description: updates.description,
        })
        .eq("id", project.id);

      if (error) throw error;

      if (updates.title) setNewTitle(updates.title);
      if (updates.description) setNewDescription(updates.description);

      toast({
        title: `Project: ${updates.title}`,
        description: updates.description,
      });
    } catch (error) {
      console.error("Error updating project:", error);
      toast({
        title: "Failed to update project",
        description: "Please try again",
      });
    }
  };

  useEffect(() => {
    handleUpdateProject({
      title: title,
      description: description,
    });
  }, [deboounceTitle, debounceDescription]);
  // #endregion

  //#region JSX
  return (
    <div className="flex flex-col border-r border-border w-96">
      <div className="p-4 flex flex-col gap-4 border-b border-border">
        <div className="flex flex-row items-start">
          <h2 className="text-sm text-muted-foreground font-semibold flex-1">
            Project Settings
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setProjectDialogOpen(true)}
          >
            <FolderOpenIcon className="w-4 h-4 opacity-50" />
            Open...
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <Input
            id="projectName"
            name="name"
            placeholder="untitled"
            value={title}
            onChange={(e) => {
              setNewTitle(e.target.value);
            }}
            onBlur={(e) => {
              const trimmedValue = e.target.value.trim();
              if (trimmedValue !== title) {
                setNewTitle(trimmedValue);
              }
            }}
          />

          <Textarea
            id="projectDescription"
            name="description"
            placeholder="Describe your video"
            className="resize-none"
            value={description}
            rows={6}
            onChange={(e) => {
              setNewDescription(e.target.value);
            }}
            onBlur={(e) => {
              const trimmedValue = e.target.value.trim();
              if (trimmedValue !== description) {
                setNewDescription(trimmedValue);
              }
            }}
          />
          {project !== PROJECT_PLACEHOLDER &&
            (!showRatio ? (
              <div className="flex flex-row justify-between text-muted-foreground">
                <div className="text-sm pl-1 pt-2">{ratio}</div>
                <button
                  onClick={() => setShowRatio(true)} // Corregido aquí
                >
                  <ChevronDown />
                </button>
              </div>
            ) : (
              <AspectRatioSelector
                value={ratio}
                onValueChange={setRatio}
                onCloseRatio={setShowRatio}
                supabase={supabase}
                project={project}
              />
            ))}
        </div>
      </div>
      <div className="flex-1 py-4 flex flex-col gap-4 border-b border-border h-full overflow-hidden relative">
        <div className="flex flex-row items-center gap-2 px-4">
          <h2 className="text-sm text-muted-foreground font-semibold flex-1">
            Media Gallery
          </h2>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2">
                  <ListPlusIcon className="w-4 h-4 opacity-50" />
                  <span className="capitalize">{mediaType}</span>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="start">
                <DropdownMenuItem
                  className="text-sm"
                  onClick={() => setMediaType("all")}
                >
                  <GalleryVerticalIcon className="w-4 h-4 opacity-50" />
                  All
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm"
                  onClick={() => setMediaType("image")}
                >
                  <ImageIcon className="w-4 h-4 opacity-50" />
                  Image
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm"
                  onClick={() => setMediaType("audio")}
                >
                  <MusicIcon className="w-4 h-4 opacity-50" />
                  audio
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm"
                  onClick={() => setMediaType("voiceover")}
                >
                  <MicIcon className="w-4 h-4 opacity-50" />
                  Voiceover
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm"
                  onClick={() => setMediaType("video")}
                >
                  <FilmIcon className="w-4 h-4 opacity-50" />
                  Video
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="secondary"
              size="sm"
              disabled={isUploading}
              className="cursor-pointer disabled:cursor-default disabled:opacity-50"
              asChild
            >
              <label htmlFor="fileUploadButton">
                <Input
                  id="fileUploadButton"
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  multiple={false}
                  disabled={isUploading}
                  accept="image/*,audio/*,video/*"
                />
                {isUploading ? (
                  <LoaderCircleIcon className="w-4 h-4 opacity-50 animate-spin" />
                ) : (
                  <CloudUploadIcon className="w-4 h-4 opacity-50" />
                )}
              </label>
            </Button>
          </div>
          {mediaItems.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openGenerateDialog()}
            >
              <SparklesIcon className="w-4 h-4 opacity-50" />
              Generate...
            </Button>
          )}
        </div>
        {!isLoading && mediaItems.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-4 px-4">
            <p className="text-sm text-center">
              Create your image, audio and voiceover collection to compose your
              videos
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openGenerateDialog()}
            >
              <ImagePlusIcon className="w-4 h-4 opacity-50" />
              Generate...
            </Button>
          </div>
        )}

        {mediaItems.length > 0 && (
          <MediaItemPanel
            supabase={supabase}
            data={mediaItems}
            setSelectedMedia={setSelectedMedia}
            mediaType={mediaType}
            className="overflow-y-auto"
            project={project}
          />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background to-transparent via-background via-60% h-8 pointer-events-none" />
      </div>
    </div>
  );
  //#endregion
}
// #endregion
