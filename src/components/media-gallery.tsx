// #region IMPORTS
import {
  ComponentProps,
  Dispatch,
  HTMLAttributes,
  MouseEventHandler,
  PropsWithChildren,
  SetStateAction,
  useMemo,
  useState,
} from "react";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetOverlay,
  SheetPanel,
  SheetPortal,
  SheetTitle,
} from "./ui/sheet";
import { useVideoProjectStore } from "@/data/store";
import { cn, resolveMediaUrl } from "@/lib/utils";
import { MediaItem } from "@/data/schema";
import {
  CopyIcon,
  FilmIcon,
  ImagesIcon,
  MicIcon,
  MusicIcon,
  TrashIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { LoadingIcon } from "./ui/icons";
import { AVAILABLE_ENDPOINTS } from "@/lib/fal";
import { SupabaseClient } from "@supabase/supabase-js";
// #endregion

// #region TYPES
type MediaGallerySheetProps = ComponentProps<typeof Sheet> & {
  media: MediaItem | null;
  setSelectedMedia: Dispatch<SetStateAction<MediaItem | null>>;
  supabase: SupabaseClient;
  mediaItems: MediaItem[];
  setMediaItems: Dispatch<SetStateAction<MediaItem[]>>;
};

type AudioPlayerProps = {
  media: MediaItem;
  mediaUrl: string;
} & HTMLAttributes<HTMLAudioElement>;
// #endregion

// #region AUDIOPLAYER
function AudioPlayer({ media, mediaUrl, ...props }: AudioPlayerProps) {
  /* const src = resolveMediaUrl(media);
  if (!src) return null; */

  return (
    <div className="flex flex-col gap-4">
      <div className="aspect-square bg-accent text-muted-foreground flex flex-col items-center justify-center">
        {media.type === "audio" && <MusicIcon className="w-1/2 h-1/2" />}
        {media.type === "voiceover" && <MicIcon className="w-1/2 h-1/2" />}
      </div>
      <div>
        <audio src={mediaUrl} {...props} controls className="rounded" />
      </div>
    </div>
  );
}
// #endregion

// #region TYPES 2
type MediaPropertyItemProps = {
  className?: string;
  label: string;
  value: string;
};
// #endregion

// #region MEDIA PROPERTY ITEM
function MediaPropertyItem({
  children,
  className,
  label,
  value,
}: PropsWithChildren<MediaPropertyItemProps>) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1 rounded bg-black/50 p-3 text-sm flex-wrap text-wrap overflow-hidden",
        className,
      )}
    >
      <div className="absolute right-2 top-2 opacity-30 transition-opacity group-hover:opacity-70">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(value);
          }}
        >
          <CopyIcon className="w-4 h-4" />
        </Button>
      </div>
      <div className="font-medium text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground text-ellipsis">
        {children ?? value}
      </div>
    </div>
  );
}
// #endregion

// #region PLACEHOLDER
const MEDIA_PLACEHOLDER: MediaItem = {
  id: "placeholder",
  user_id: "placeholder",
  type: "image",
  source_type: "generated",
  file_path: "placeholder",
  created_at: 0,
  metadata: undefined,
};
// #endregion

// #region Media
export function MediaGallerySheet({
  media,
  setSelectedMedia,
  supabase,
  mediaItems,
  setMediaItems,
  ...props
}: MediaGallerySheetProps) {
  // #region CONST
  const selectedMedia = media ?? MEDIA_PLACEHOLDER;
  const [isDeleting, setIsDeleting] = useState(false);
  const setGenerateData = useVideoProjectStore((s) => s.setGenerateData);
  const setEndpointId = useVideoProjectStore((s) => s.setEndpointId);
  const setGenerateMediaType = useVideoProjectStore(
    (s) => s.setGenerateMediaType,
  );
  const onGenerate = useVideoProjectStore((s) => s.onGenerate);
  // #endregion

  // #region GENERATE  MEDIA
  const handleOpenGenerateDialog = () => {
    setGenerateMediaType("video");
    const image =
      selectedMedia.metadata && "output" in selectedMedia.metadata
        ? selectedMedia.metadata.output?.images?.[0]?.url
        : undefined;

    const endpoint = AVAILABLE_ENDPOINTS.find(
      (endpoint) => endpoint.category === "video",
    );

    setEndpointId(endpoint?.endpointId ?? AVAILABLE_ENDPOINTS[0].endpointId);

    setGenerateData({
      ...(selectedMedia.metadata && "input" in selectedMedia.metadata
        ? selectedMedia.metadata.input
        : {}),
      image,
      duration: undefined,
    });
    setSelectedMedia(null);
    onGenerate();
  };

  const handleVary = () => {
    setGenerateMediaType(selectedMedia.type);
    setEndpointId(
      selectedMedia?.metadata && "endpointId" in selectedMedia.metadata
        ? selectedMedia.metadata.endpointId
        : "",
    );
    setGenerateData(
      selectedMedia.metadata && "input" in selectedMedia.metadata
        ? selectedMedia.metadata.input
        : {},
    );
    setSelectedMedia(null);
    onGenerate();
  };
  // #endregion

  // Event handlers
  const preventClose: MouseEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const close = () => {
    setSelectedMedia(null);
  };
  const mediaUrl = useMemo(
    () =>
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${selectedMedia.file_path}`,
    [selectedMedia],
  );

  const prompt =
    selectedMedia?.metadata && "input" in selectedMedia.metadata
      ? selectedMedia.metadata.input?.prompt
      : selectedMedia?.metadata && "description" in selectedMedia.metadata
        ? selectedMedia.metadata.description
        : undefined;

  const queryClient = useQueryClient();

  // #region DELETE MEDIA
  const deleteMedia = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("assets")
        .delete()
        .eq("id", selectedMedia.id);

      if (error) throw error;

      const { error: errorStorage } = await supabase.storage
        .from("assets")
        .remove([selectedMedia.file_path]);

      if (errorStorage) throw errorStorage;

      setMediaItems((prevMediaItems) =>
        prevMediaItems.filter((item) => item.id !== selectedMedia.id),
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error!", error.message);
      } else {
        console.error("Unknown error", error);
      }
    }
    setIsDeleting(false);
    close();
  };
  // #endregion

  // #region MAIN JSX
  return (
    <Sheet {...props}>
      <SheetOverlay className="pointer-events-none flex flex-col" />
      <SheetPortal>
        <div
          className="pointer-events-auto fixed inset-0 z-[51] mr-[42rem] flex flex-col items-center justify-center gap-4 px-32 py-16"
          onClick={close}
        >
          {mediaUrl && (
            <>
              {selectedMedia.type === "image" && (
                <img
                  src={mediaUrl}
                  className="animate-fade-scale-in h-auto max-h-[90%] w-auto max-w-[90%] object-contain transition-all"
                  onClick={preventClose}
                />
              )}
              {selectedMedia.type === "video" && (
                <video
                  src={mediaUrl}
                  className="animate-fade-scale-in h-auto max-h-[90%] w-auto max-w-[90%] object-contain transition-all"
                  controls
                  onClick={preventClose}
                />
              )}
              {(selectedMedia.type === "audio" ||
                selectedMedia.type === "voiceover") && (
                <AudioPlayer media={selectedMedia} mediaUrl={mediaUrl} />
              )}
            </>
          )}
          <style jsx>{`
            @keyframes fadeScaleIn {
              from {
                opacity: 0;
                transform: scale(0.8);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
            .animate-fade-scale-in {
              animation: fadeScaleIn 0.3s ease-out forwards;
            }
          `}</style>
        </div>
        <SheetPanel
          className="flex h-screen max-h-screen min-h-screen flex-col overflow-hidden sm:max-w-2xl"
          onPointerDownOutside={preventClose as any}
        >
          <SheetHeader>
            <SheetTitle>Media Gallery</SheetTitle>
            <SheetDescription className="sr-only">
              The b-roll for your video composition
            </SheetDescription>
          </SheetHeader>
          <div className="flex h-full max-h-full flex-1 flex-col gap-8 overflow-y-hidden">
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground">
                {prompt ?? <span className="italic">No description</span>}
              </p>
              <div></div>
            </div>
            <div className="flex flex-row gap-2">
              {selectedMedia?.type === "image" && (
                <Button
                  onClick={handleOpenGenerateDialog}
                  variant="secondary"
                  disabled={isDeleting}
                >
                  <FilmIcon className="w-4 h-4 opacity-50" />
                  Make Video
                </Button>
              )}
              <Button
                onClick={handleVary}
                variant="secondary"
                disabled={isDeleting}
              >
                <ImagesIcon className="w-4 h-4 opacity-50" />
                Re-run
              </Button>
              <Button
                variant="secondary"
                disabled={isDeleting}
                onClick={deleteMedia}
              >
                {isDeleting ? (
                  <LoadingIcon />
                ) : (
                  <TrashIcon className="w-4 h-4 opacity-50" />
                )}
                Delete
              </Button>
            </div>
            <div className="flex-1 flex flex-col gap-2 justify-end">
              <MediaPropertyItem label="Media URL" value={mediaUrl ?? "n/a"} />
              <MediaPropertyItem
                label="Model (fal endpoint)"
                value={
                  selectedMedia?.metadata &&
                  "endpointId" in selectedMedia.metadata
                    ? selectedMedia.metadata.endpointId
                    : "n/a"
                }
              >
                <a
                  href={`https://fal.ai/models/
                    ${
                      selectedMedia?.metadata &&
                      "endpointId" in selectedMedia.metadata
                        ? selectedMedia.metadata.endpointId
                        : "n/a"
                    }
                  `}
                  target="_blank"
                  className="underline underline-offset-4 decoration-muted-foreground/70 decoration-dotted"
                >
                  <code>
                    {selectedMedia?.metadata &&
                    "endpointId" in selectedMedia.metadata
                      ? selectedMedia.metadata.endpointId
                      : "n/a"}
                  </code>
                </a>
              </MediaPropertyItem>
              <MediaPropertyItem
                label="Status"
                value={
                  selectedMedia?.metadata && "status" in selectedMedia.metadata
                    ? selectedMedia.metadata.status
                    : "n/a"
                }
              />
              <MediaPropertyItem
                label="Request ID"
                value={
                  selectedMedia?.metadata &&
                  "requestId" in selectedMedia.metadata
                    ? selectedMedia.metadata.requestId
                    : "n/a"
                }
              >
                <code>
                  {selectedMedia?.metadata &&
                  "requestId" in selectedMedia.metadata
                    ? selectedMedia.metadata.requestId
                    : "n/a"}
                </code>
              </MediaPropertyItem>
            </div>
          </div>
        </SheetPanel>
      </SheetPortal>
    </Sheet>
  );
  // #endregion
}
// #endregion
