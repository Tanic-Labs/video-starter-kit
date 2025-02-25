"use client";
// #region IMPORTS
import { useJobCreator } from "@/data/mutations";
import { queryKeys, useProject, useProjectMediaItems } from "@/data/queries";
import type { MediaItem } from "@/data/schema";
import {
  type GenerateData,
  type MediaType,
  useProjectId,
  useVideoProjectStore,
} from "@/data/store";
import { AVAILABLE_ENDPOINTS, type InputAsset } from "@/lib/fal";
import {
  ImageIcon,
  MicIcon,
  MusicIcon,
  LoaderCircleIcon,
  VideoIcon,
  ArrowLeft,
  TrashIcon,
  WandSparklesIcon,
  CrossIcon,
  XIcon,
} from "lucide-react";
import { MediaItemRow } from "./media-panel";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

import { useEffect, useMemo, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import type { ClientUploadedFileData } from "uploadthing/types";
import { db } from "@/data/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  assetKeyMap,
  cn,
  getAssetKey,
  getAssetType,
  mapInputKey,
  resolveMediaUrl,
} from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { enhancePrompt } from "@/lib/prompt";
import { WithTooltip } from "./ui/tooltip";
import { Label } from "./ui/label";
import { VoiceSelector } from "./playht/voice-selector";
import { LoadingIcon } from "./ui/icons";
import { getMediaMetadata } from "@/lib/ffmpeg";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { type } from "os";
import { metadata } from "@/app/layout"; // <--- new imoports 58 - 59
// #endregion

//DIVIDER <-- this
// #region TYPE MODEL ENDPOINT PICKER
type ModelEndpointPickerProps = {
  mediaType: string;
  onValueChange: (value: MediaType) => void;
} & Parameters<typeof Select>[0];
// #endregion

// #region MODEL ENDPOINT PICKER
function ModelEndpointPicker({
  mediaType,
  ...props
}: ModelEndpointPickerProps) {
  const endpoints = useMemo(
    () =>
      AVAILABLE_ENDPOINTS.filter((endpoint) => endpoint.category === mediaType),
    [mediaType],
  );
  return (
    <Select {...props}>
      <SelectTrigger className="text-base w-full minw-56 font-semibold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {endpoints.map((endpoint) => (
          <SelectItem key={endpoint.endpointId} value={endpoint.endpointId}>
            <div className="flex flex-row gap-2 items-center">
              <span>{endpoint.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
// #endregion

// #region TYPE RIGHT PANEL
type RightPanelProps = {
  supabase: SupabaseClient;
  user: User | null;
  onOpenChange?: (open: boolean) => void;
};
// #endregion

// #region MAIN RIGHT PANEL
export default function RightPanel({
  supabase,
  user,
  onOpenChange,
  ...props
}: RightPanelProps) {
  // #region Const
  const videoProjectStore = useVideoProjectStore((s) => s);
  const {
    generateData,
    setGenerateData,
    resetGenerateData,
    endpointId,
    setEndpointId,
  } = videoProjectStore;

  const [tab, setTab] = useState<string>("generation");
  const [assetMediaType, setAssetMediaType] = useState("all");
  const [urlImage, setUrlImage] = useState("");
  const [urlAudio, setUrlAudio] = useState("");
  const [urlVideo, setUrlVideo] = useState("");
  const [loading, setLoading] = useState(false); // <-- urls and loading states 126 - 129
  const projectId = useProjectId();
  const openGenerateDialog = useVideoProjectStore((s) => s.openGenerateDialog);
  const generateDialogOpen = useVideoProjectStore((s) => s.generateDialogOpen);
  const closeGenerateDialog = useVideoProjectStore(
    (s) => s.closeGenerateDialog,
  );
  const queryClient = useQueryClient();
  const { data: project } = useProject(projectId);

  const { toast } = useToast();
  // #endregion

  // #region Handle Open Change
  const handleOnOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      closeGenerateDialog();
      resetGenerateData();
      return;
    }
    onOpenChange?.(isOpen);
    openGenerateDialog();
  };
  // #endregion

  // #region Enhace
  const enhance = useMutation({
    mutationFn: async () => {
      return enhancePrompt(generateData.prompt, {
        type: mediaType,
        project,
      });
    },
    onSuccess: (enhancedPrompt) => {
      setGenerateData({ prompt: enhancedPrompt });
    },
    onError: (error) => {
      console.warn("Failed to create suggestion", error);
      toast({
        title: "Failed to enhance prompt",
        description: "There was an unexpected error. Try again.",
      });
    },
  });
  // #endregion

  // #region Set media
  const { data: mediaItems = [] } = useProjectMediaItems(projectId);
  const mediaType = useVideoProjectStore((s) => s.generateMediaType);
  const setMediaType = useVideoProjectStore((s) => s.setGenerateMediaType);

  const endpoint = useMemo(
    () =>
      AVAILABLE_ENDPOINTS.find(
        (endpoint) => endpoint.endpointId === endpointId,
      ),
    [endpointId], 
  );
  const handleMediaTypeChange = (mediaType: string) => {
    setMediaType(mediaType as MediaType);
    const endpoint = AVAILABLE_ENDPOINTS.find(
      (endpoint) => endpoint.category === mediaType,
    );

    const initialInput = endpoint?.initialInput || {};

    if (
      (mediaType === "video" &&
        endpoint?.endpointId === "fal-ai/hunyuan-video") ||
      mediaType !== "video"
    ) {
      setGenerateData({ image: null, ...initialInput });
    } else {
      setGenerateData({ ...initialInput });
    }

    setEndpointId(endpoint?.endpointId ?? AVAILABLE_ENDPOINTS[0].endpointId);
  };
  // #endregion

  // #region Input Type
  // TODO improve model-specific parameters
  type InputType = {
    prompt: string;
    image_url?: File | string | null;
    video_url?: File | string | null;
    audio_url?: File | string | null;
    image_size?: { width: number; height: number } | string;
    aspect_ratio?: string;
    seconds_total?: number;
    voice?: string;
    input?: string;
    reference_audio_url?: File | string | null;
  };

  const input: InputType = {
    prompt: generateData.prompt,
    image_url: undefined,
    image_size: mediaType === "image" ? "landscape_16_9" : undefined,
    aspect_ratio: mediaType === "video" ? "16:9" : undefined,
    seconds_total: generateData.duration ?? undefined,
    voice:
      endpointId === "fal-ai/playht/tts/v3" ? generateData.voice : undefined,
    input:
      endpointId === "fal-ai/playht/tts/v3" ? generateData.prompt : undefined,
  };

  if (generateData.image) {
    input.image_url = generateData.image;
  }
  if (generateData.video_url) {
    input.video_url = generateData.video_url;
  }
  if (generateData.audio_url) {
    input.audio_url = generateData.audio_url;
  }
  if (generateData.reference_audio_url) {
    input.reference_audio_url = generateData.reference_audio_url;
  }

  const extraInput =
    endpointId === "fal-ai/f5-tts"
      ? {
          gen_text: generateData.prompt,
          ref_audio_url:
            "https://github.com/SWivid/F5-TTS/raw/21900ba97d5020a5a70bcc9a0575dc7dec5021cb/tests/ref_audio/test_en_1_ref_short.wav",
          ref_text: "Some call me nature, others call me mother nature.",
          model_type: "F5-TTS",
          remove_silence: true,
        }
      : {};
  const createJob = useJobCreator({
    userId: user?.id ?? "", // <--- add user or empty string / must return if no user
    projectId,
    endpointId:
      generateData.image && mediaType === "video"
        ? `${endpointId}/image-to-video`
        : endpointId,
    mediaType,
    input: {
      ...(endpoint?.initialInput || {}),
      ...mapInputKey(input, endpoint?.inputMap || {}),
      ...extraInput,
    },
    urlImage,
    urlAudio,
    urlVideo, // <-- add urls 273 - 275
  });
  // #endregion

  // #region Handle Generate
  // const handleOnGenerate = async () => {
  //   await createJob.mutateAsync({} as any, {
  //     onSuccess: async () => {
  //       if (!createJob.isError) {
  //         handleOnOpenChange(false);
  //       }
  //     },
  //   });
  // }; // <-- replace Generate 280 - 288

  const handleOnGenerate = async () => {
    await createJob.mutateAsync({} as any, {
      onSuccess: () => {
        handleOnOpenChange(false);
      },
      onError: (error) => {
        toast({
          title: "Failed",
          description: `Error: ${error.message}. Please try again.`,
        });
        handleOnOpenChange(false);
      },
    });
  }; // <-- replace Generate 290 - 303

  useEffect(() => {
    videoProjectStore.onGenerate = handleOnGenerate;
  }, [handleOnGenerate]);
  // #endregion

  // #region Select Media
  const handleSelectMedia = (media: MediaItem) => {
    const asset = endpoint?.inputAsset?.find((item) => {
      const assetType = getAssetType(item);

      if (
        assetType === "audio" &&
        (media.type === "voiceover" || media.type === "audio")
      ) {
        return true;
      }
      return assetType === media.type;
    });

    if (!asset) {
      setTab("generation");
      return;
    }

    setGenerateData({ [getAssetKey(asset)]: resolveMediaUrl(media) });
    setTab("generation");
  };
  // #endregion

  // #region Upload data
  const { startUpload, isUploading } = useUploadThing("fileUploader");

  // MODIFED HANDLE FILE LOAD 
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    asset: any,
    index: any,
  ) => {
    console.log("INDEX", index);
    console.log("asset", asset);

    const files = e.target.files;
    if (!files) return;

    setLoading(true); // Activa el loader al iniciar la subida

    try {
      const uploadedFiles = await uploadToSupabase(Array.from(files), asset);
      if (uploadedFiles) {
        await handleUploadComplete(uploadedFiles);
      }
    } catch (err) {
      setUrlImage("");
      setUrlAudio("");
      setUrlVideo("");
      console.warn(`ERROR! ${err}`);
      toast({
        title: "Failed to upload file",
        description: "Please try again",
      });
    } finally {
      setLoading(false); // Desactiva el loader sin importar si hubo éxito o error
    }
  };
  // MODIFIED HANDLE FILE LOAD 337 - 369

  // ADD SUPABASE UPLOAD
  const uploadToSupabase = async (files: File[], asset: any) => {
    console.log("FILE", files);
    const uniqueId = crypto.randomUUID();
    const uploadedFiles = [];
    let filePath;
    let typeofFilepath;

    for (const file of files) {
      const fileExt = file.type.split("/")[1];
      console.log("FILE111", fileExt);
      typeofFilepath = mediaType === "audio" ? asset.type : asset;
      console.log("FILE222", typeofFilepath);
      filePath = `${user?.id}/${typeofFilepath}s/${uniqueId}.${fileExt}`;
      console.log("FILE3333", filePath);

      const { data, error } = await supabase.storage
        .from("assets")
        .upload(filePath, file);

      if (error) {
        throw error;
      }

      // Obtener la URL pública del archivo
      const {
        data: { publicUrl },
      } = supabase.storage.from("assets").getPublicUrl(filePath);
      if (typeofFilepath === "audio") {
        setUrlAudio(publicUrl);
      } else if (typeofFilepath === "video") {
        setUrlVideo(publicUrl);
      } else if (typeofFilepath === "image") {
        setUrlImage(publicUrl);
      }

      uploadedFiles.push({
        url: publicUrl,
        type: file.type,
        name: file.name,
        size: file.size,
      });
      console.log("mimi", uploadedFiles);
    }

    const { data: generationData, error: generationError } = await supabase
      .from("assets")
      .insert([
        {
          id: uniqueId,
          user_id: user?.id,
          type: typeofFilepath,
          source_type: "uploaded",
          file_path: filePath,
          metadata: uploadedFiles,
        },
      ])
      .select("*")
      .single();
    console.log("generationError", generationError);
    if (!generationData) {
      throw new Error("No generation data returned");
    }

    return uploadedFiles;
  };
  // ADD SUPABASE UPLOAD 437

  const handleUploadComplete = async (
    files: Array<{
      url: string;
      type: string;
      name: string;
      size: number;
    }>, // <-- add new params 440 - 445
  ) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mediaType = file.type.split("/")[0];
      const outputType = mediaType === "audio" ? "audio" : mediaType;

      const data: Omit<MediaItem, "id"> = {
        user_id: user ? user.id : "",
        source_type: "uploaded",
        created_at: Date.now(),
        type: outputType as MediaType,
        file_path: file.url,
        metadata: {
          name: file.name,
          size: file.size, // <-- add new metadata name and size 459 - 460
          type: outputType as MediaType,
          description: "prompt",
          original_name: file.name, // <-- file name added
        },
      };

      setGenerateData({
        ...generateData,
        [assetKeyMap[outputType as keyof typeof assetKeyMap]]: file.url,
      });

      // Si necesitas mantener un registro en la base de datos
      const { data: mediaRecord, error } = await supabase
        .from("media")
        .insert([data])
        .select()
        .single();

      if (error) {
        console.error("Error saving media record:", error);
        continue;
      } // <-- media table? Replace for assetst 472 - 482

      if (mediaRecord && mediaRecord.type !== "image") {
        const mediaMetadata = await getMediaMetadata(mediaRecord as MediaItem);

        const { error: updateError } = await supabase
          .from("media")
          .update({
            metadata: mediaMetadata?.media || {},
          })
          .eq("id", mediaRecord.id);

        if (!updateError) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.projectMediaItems(projectId),
          });
        }
      } // <-- add if and update media table, replace for assests 484 - 499
    }
  };
  // #endregion

  // #region Right Panel JSX Main
  return (
    <div
      className={cn(
        "flex flex-col border-l border-border w-96 z-50 transition-all duration-300 absolute top-0 h-full bg-background",
        generateDialogOpen ? "right-0" : "-right-96",
      )}
    >
      <div className="flex-1 p-4 flex flex-col gap-4 border-b border-border h-full overflow-hidden relative">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-sm text-muted-foreground font-semibold flex-1">
            Generate Media
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOnOpenChange(false)}
            className="flex items-center gap-2"
          >
            <XIcon className="w-6 h-6" />
          </Button>
        </div>
        <div className="w-full flex flex-col">
          <div className="flex w-full gap-2">
            <Button
              variant="ghost"
              onClick={() => handleMediaTypeChange("image")}
              className={cn(
                mediaType === "image" && "bg-white/10",
                "h-14 flex flex-col justify-center w-1/4 rounded-md gap-2 items-center",
              )}
            >
              <ImageIcon className="w-4 h-4 opacity-50" />
              <span className="text-[10px]">Image</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleMediaTypeChange("video")}
              className={cn(
                mediaType === "video" && "bg-white/10",
                "h-14 flex flex-col justify-center w-1/4 rounded-md gap-2 items-center",
              )}
            >
              <VideoIcon className="w-4 h-4 opacity-50" />
              <span className="text-[10px]">Video</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleMediaTypeChange("voiceover")}
              className={cn(
                mediaType === "voiceover" && "bg-white/10",
                "h-14 flex flex-col justify-center w-1/4 rounded-md gap-2 items-center",
              )}
            >
              <MicIcon className="w-4 h-4 opacity-50" />
              <span className="text-[10px]">Voiceover</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleMediaTypeChange("audio")}
              className={cn(
                mediaType === "audio" && "bg-white/10",
                "h-14 flex flex-col justify-center w-1/4 rounded-md gap-2 items-center",
              )}
            >
              <MusicIcon className="w-4 h-4 opacity-50" />
              <span className="text-[10px]">Audio</span>
            </Button>
          </div>
          <div className="flex flex-col gap-2 mt-2 justify-start font-medium text-base">
            <div className="text-muted-foreground">Using</div>
            <ModelEndpointPicker
              mediaType={mediaType}
              value={endpointId}
              onValueChange={(endpointId) => {
                resetGenerateData();
                setEndpointId(endpointId);

                const endpoint = AVAILABLE_ENDPOINTS.find(
                  (endpoint) => endpoint.endpointId === endpointId,
                );

                const initialInput = endpoint?.initialInput || {};
                setGenerateData({ ...initialInput });
              }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 relative">
          {endpoint?.inputAsset?.map((asset, index) => (
            <div key={getAssetType(asset)} className="flex w-full">
              <div className="flex flex-col w-full" key={getAssetType(asset)}>
                <div className="flex justify-between">
                  <h4 className="capitalize text-muted-foreground mb-2">
                    {getAssetType(asset)} Reference
                  </h4>
                  {tab === `asset-${getAssetType(asset)}` && (
                    <Button
                      variant="ghost"
                      onClick={() => setTab("generation")}
                      size="sm"
                    >
                      <ArrowLeft /> Back
                    </Button>
                  )}
                </div>
                {(tab === "generation" ||
                  tab !== `asset-${getAssetType(asset)}`) && (
                  <>
                    {!generateData[getAssetKey(asset)] && (
                      <div className="flex flex-col gap-2 justify-between">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setTab(`asset-${getAssetType(asset)}`);
                            setAssetMediaType(getAssetType(asset) ?? "all");
                          }}
                          className="cursor-pointer min-h-[30px] flex flex-col items-center justify-center border border-dashed border-border rounded-md px-4"
                        >
                          <span className="text-muted-foreground text-xs text-center text-nowrap">
                            Select
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={loading} // <-- change disable
                          className="cursor-pointer min-h-[30px] flex flex-col items-center justify-center border border-dashed border-border rounded-md px-4"
                          asChild
                        >
                          <label htmlFor="assetUploadButton">
                            <Input
                              id="assetUploadButton"
                              type="file"
                              className="hidden"
                              onChange={(e) =>
                                handleFileUpload(e, asset, index)
                              } // Aquí pasas `e` correctamente // <-- upsade on change 639 - 641
                              multiple={false}
                              disabled={loading} // <-- change disable
                              accept="image/*,audio/*,video/*"
                            />
                            {loading ? ( // <-- change condition
                              <LoaderCircleIcon className="w-4 h-4 opacity-50 animate-spin" />
                            ) : (
                              <span className="text-muted-foreground text-xs text-center text-nowrap">
                                Upload
                              </span>
                            )}
                          </label>
                        </Button>
                      </div>
                    )}
                    {generateData[getAssetKey(asset)] && (
                      <div className="cursor-pointer overflow-hidden relative w-full flex flex-col items-center justify-center border border-dashed border-border rounded-md">
                        <WithTooltip tooltip="Remove media">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-black/50 absolute top-1 z-50 bg-black/80 right-1 group-hover:text-white"
                            onClick={() => {
                              resetGenerateData();
                              setUrlImage("");
                              setUrlAudio("");
                              setUrlVideo("");
                            }} // <-- replace onClick for urls 663 - 668
                          >
                            <TrashIcon className="w-3 h-3 stroke-2" />
                          </button>
                        </WithTooltip>
                        {generateData[getAssetKey(asset)] && (
                          <SelectedAssetPreview
                            asset={asset}
                            data={generateData}
                          />
                        )}
                      </div>
                    )}
                  </>
                )}
                {tab === `asset-${getAssetType(asset)}` && (
                  <div className="flex items-center gap-2 flex-wrap overflow-y-auto max-h-80 divide-y divide-border">
                    {mediaItems
                      .filter((media) => {
                        if (assetMediaType === "all") return true;
                        if (
                          assetMediaType === "audio" &&
                          (media.type === "voiceover" || media.type === "audio")
                        )
                          return true;
                        return media.type === assetMediaType;
                      })
                      .map((job) => (
                        <MediaItemRow
                          draggable={false}
                          key={job.id}
                          data={job}
                          onOpen={handleSelectMedia}
                          className="cursor-pointer"
                          supabase={supabase}
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="relative bg-border rounded-lg pb-10 placeholder:text-base w-full  resize-none">
            <Textarea
              className="text-base shadow-none focus:!ring-0 placeholder:text-base w-full h-32 resize-none"
              placeholder="Imagine..."
              value={generateData.prompt}
              rows={3}
              onChange={(e) => setGenerateData({ prompt: e.target.value })}
            />
            <WithTooltip tooltip="Enhance your prompt with AI-powered suggestions.">
              <div className="absolute bottom-2 right-2">
                <Button
                  variant="secondary"
                  disabled={enhance.isPending}
                  className="bg-purple-400/10 text-purple-400 text-xs rounded-full h-6 px-3"
                  onClick={() => enhance.mutate()}
                >
                  {enhance.isPending ? (
                    <LoadingIcon />
                  ) : (
                    <WandSparklesIcon className="opacity-50" />
                  )}
                  Enhance Prompt
                </Button>
              </div>
            </WithTooltip>
          </div>
        </div>

        {tab === "generation" && (
          <div className="flex flex-col gap-2 mb-2">
            {mediaType === "audio" && endpointId === "fal-ai/playht/tts/v3" && (
              <div className="flex-1 flex flex-row gap-2">
                {mediaType === "audio" && (
                  <div className="flex flex-row items-center gap-1">
                    <Label>Duration</Label>
                    <Input
                      className="w-12 text-center tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min={5}
                      max={30}
                      step={1}
                      type="number"
                      value={generateData.duration}
                      onChange={(e) =>
                        setGenerateData({
                          duration: Number.parseInt(e.target.value),
                        })
                      }
                    />
                    <span>s</span>
                  </div>
                )}
                {endpointId === "fal-ai/playht/tts/v3" && (
                  <VoiceSelector
                    value={generateData.voice}
                    onValueChange={(voice) => {
                      setGenerateData({ voice });
                    }}
                  />
                )}
              </div>
            )}
            <div className="flex flex-row gap-2">
              <Button
                className="w-full"
                disabled={enhance.isPending || createJob.isPending}
                onClick={handleOnGenerate}
              >
                {enhance.isPending || createJob.isPending
                  ? "Loading"
                  : "Generate"}
              </Button>
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background to-transparent via-background via-60% h-8 pointer-events-none" />
      </div>
    </div>
  );
  // #endregion
}
// #endregion

// #region SELEECT ASSEST PREVIEW
const SelectedAssetPreview = ({
  data,
  asset,
}: {
  data: GenerateData;
  asset: InputAsset;
}) => {
  const assetType = getAssetType(asset);
  const assetKey = getAssetKey(asset);

  if (!data[assetKey]) return null;

  return (
    <>
      {assetType === "audio" && (
        <audio
          src={
            data[assetKey] && typeof data[assetKey] !== "string"
              ? URL.createObjectURL(data[assetKey])
              : data[assetKey] || ""
          }
          controls={true}
        />
      )}
      {assetType === "video" && (
        <video
          src={
            data[assetKey] && typeof data[assetKey] !== "string"
              ? URL.createObjectURL(data[assetKey])
              : data[assetKey] || ""
          }
          controls={false}
          style={{ pointerEvents: "none" }}
        />
      )}
      {assetType === "image" && (
        <img
          id="image-preview"
          src={
            data[assetKey] && typeof data[assetKey] !== "string"
              ? URL.createObjectURL(data[assetKey])
              : data[assetKey] || ""
          }
          alt="Media Preview"
        />
      )}
    </>
  );
};
// #endregion
