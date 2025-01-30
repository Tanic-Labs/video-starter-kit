import {
  ComponentProps,
  Dispatch,
  HTMLAttributes,
  MouseEventHandler,
  PropsWithChildren,
  SetStateAction,
  useMemo,
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
import {
  queryKeys,
  refreshVideoCache,
  useProjectMediaItems,
} from "@/data/queries";
import { useProjectId, useVideoProjectStore } from "@/data/store";
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
import { Separator } from "./ui/separator";
import { formatDuration } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/data/db";
import { LoadingIcon } from "./ui/icons";
import { AVAILABLE_ENDPOINTS } from "@/lib/fal";
import { metadata } from "@/app/layout";

type MediaGallerySheetProps = ComponentProps<typeof Sheet> & {
  media: MediaItem | null;
  setSelectedMedia: Dispatch<SetStateAction<MediaItem | null>>;
};

type AudioPlayerProps = {
  media: MediaItem;
} & HTMLAttributes<HTMLAudioElement>;

function AudioPlayer({ media, ...props }: AudioPlayerProps) {
  const src = resolveMediaUrl(media);
  if (!src) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="aspect-square bg-accent text-muted-foreground flex flex-col items-center justify-center">
        {media.type === "audio" && <MusicIcon className="w-1/2 h-1/2" />}
        {media.type === "voiceover" && <MicIcon className="w-1/2 h-1/2" />}
      </div>
      <div>
        <audio src={src} {...props} controls className="rounded" />
      </div>
    </div>
  );
}

type MediaPropertyItemProps = {
  className?: string;
  label: string;
  value: string;
};

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

const MEDIA_PLACEHOLDER: MediaItem = {
  id: "placeholder",
  user_id: "placeholder",
  type: "image",
  source_type: "generated",
  file_path: "placeholder",
  crated_at: 0,
  metadata: undefined,
};

export function MediaGallerySheet({
  media,
  setSelectedMedia,
  ...props
}: MediaGallerySheetProps) {
  const projectId = useProjectId();
  const { data: mediaItems = [] } = useProjectMediaItems(projectId);
  const selectedMedia = media ?? MEDIA_PLACEHOLDER;
  const setSelectedMediaId = useVideoProjectStore((s) => s.setSelectedMediaId);
  const setGenerateData = useVideoProjectStore((s) => s.setGenerateData);
  const setEndpointId = useVideoProjectStore((s) => s.setEndpointId);
  const setGenerateMediaType = useVideoProjectStore(
    (s) => s.setGenerateMediaType,
  );
  const onGenerate = useVideoProjectStore((s) => s.onGenerate);

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
  const deleteMedia = useMutation({
    mutationFn: () => db.media.delete(selectedMediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectMediaItems(projectId),
      });
      refreshVideoCache(queryClient, projectId);
      close();
    },
  });

  return (
    <Sheet {...props}>
      <SheetOverlay className="pointer-events-none flex flex-col" />
      <SheetPortal>
        <div
          className="pointer-events-auto fixed inset-0 z-[51] mr-[42rem] flex flex-col items-center justify-center gap-4 px-32 py-16"
          onClick={close}
        >
          {!!mediaUrl && (
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
                <AudioPlayer media={selectedMedia} />
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
                  disabled={deleteMedia.isPending}
                >
                  <FilmIcon className="w-4 h-4 opacity-50" />
                  Make Video
                </Button>
              )}
              <Button
                onClick={handleVary}
                variant="secondary"
                disabled={deleteMedia.isPending}
              >
                <ImagesIcon className="w-4 h-4 opacity-50" />
                Re-run
              </Button>
              <Button
                variant="secondary"
                disabled={deleteMedia.isPending}
                onClick={() => deleteMedia.mutate()}
              >
                {deleteMedia.isPending ? (
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
}
