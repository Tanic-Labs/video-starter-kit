import { db } from "@/data/db";
import { queryKeys } from "@/data/queries";
import type { MediaItem, VideoProject } from "@/data/schema";
import { useProjectId, useVideoProjectStore } from "@/data/store";
import { fal } from "@/lib/fal";
import { cn, resolveMediaUrl, trackIcons } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  CircleXIcon,
  GripVerticalIcon,
  HourglassIcon,
  ImageIcon,
  MicIcon,
  MusicIcon,
  VideoIcon,
} from "lucide-react";
import {
  Dispatch,
  type DragEventHandler,
  Fragment,
  type HTMLAttributes,
  SetStateAction,
  createElement,
  useEffect,
  useState,
} from "react";
import { Badge } from "./ui/badge";
import { LoadingIcon } from "./ui/icons";
import { useToast } from "@/hooks/use-toast";
import { getMediaMetadata } from "@/lib/ffmpeg";
import { metadata } from "@/app/layout";
import { SupabaseClient } from "@supabase/supabase-js";

type MediaItemRowProps = {
  supabase: SupabaseClient;
  data: MediaItem;
  onOpen: (data: MediaItem) => void;
  draggable?: boolean;
  project: VideoProject;
} & HTMLAttributes<HTMLDivElement>;

export function MediaItemRow({
  supabase,
  data,
  className,
  onOpen,
  draggable = true,
  project,
  ...props
}: MediaItemRowProps) {
  const isDone =
    data?.metadata &&
    "status" in data.metadata &&
    (data.metadata.status === "completed" || data.metadata.status === "failed");
  const queryClient = useQueryClient();
  const projectId = project.id
  const { toast } = useToast();
  useQuery({
    queryKey: queryKeys.projectMedia(projectId, data.id),
    queryFn: async () => {
      if (data.source_type === "uploaded") return null;
      const queueStatus = await fal.queue.status(
        data?.metadata && "endpointId" in data.metadata
          ? data.metadata.endpointId
          : "",
        {
          requestId:
            data?.metadata && "requestId" in data.metadata
              ? data.metadata.requestId
              : "",
        },
      );
      if (queueStatus.status === "IN_PROGRESS") {
        /* await db.media.update(data.id, {
          ...data,
          status: "running",
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projectMediaItems(data.projectId),
        }); */
        const { data: progressData, error: progressError } = await supabase
          .from("assets")
          .update({
            metadata: {
              ...data.metadata,
              status: "runnin",
            },
          })
          .eq("id", data.id)
          .select("*");

        if (progressError) {
          console.error("Error updating asset:", progressError);
        } else {
          console.log("Asset actualizado:", progressData);
        }
      }
      let media: Partial<MediaItem> = {};

      if (queueStatus.status === "COMPLETED") {
        try {
          const result = await fal.queue.result(
            data?.metadata && "endpointId" in data.metadata
              ? data.metadata.endpointId
              : "",
            {
              requestId:
                data?.metadata && "requestId" in data.metadata
                  ? data.metadata.requestId
                  : "",
            },
          );
          media = {
            ...data,
            metadata:
              data.metadata && data.source_type === "generated"
                ? {
                    ...data.metadata,
                    output: result.data,
                    status: "completed",
                  }
                : data.metadata,
          };

          // update to sapabe in future
          await db.media.update(data.id, media);

          const { data: completedData, error: completedError } = await supabase
            .from("assets")
            .update({
              metadata: {
                ...data.metadata,
                output: result.data,
                status: "completed",
              },
            })
            .eq("id", data.id)
            .select("*");

          if (completedError) {
            console.error("Error updating asset:", completedError);
          } else {
            console.log("Asset updated:", completedData);
          }

          toast({
            title: "Generation completed",
            description: `Your ${data.type} has been generated successfully.`,
          });
        } catch {
          await db.media.update(data.id, {
            ...data,
            metadata:
              data.metadata && data.source_type === "generated"
                ? {
                    ...data.metadata,
                    status: "failed",
                  }
                : data.metadata,
          }); // update tu supabase in futere

          const { data: failData, error: failError } = await supabase
            .from("assets")
            .update({
              metadata: {
                ...data.metadata,
                status: "failed",
              },
            })
            .eq("id", data.id)
            .select("*");

          if (failError) {
            console.error("Error updating asset:", failError);
          } else {
            console.log("Asset updated:", failData);
          }

          toast({
            title: "Generation failed",
            description: `Failed to generate ${data.type}.`,
          });
        }
        finally {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.projectMediaItems(projectId),
          });
        }
      }

      return null;
    },
    enabled: !isDone && data.source_type === "generated",
    refetchInterval: data.type === "video" ? 20000 : 1000,
  });
  const mediaUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${data.file_path}`;
  const mediaId = data.id.split("-")[0];
  const handleOnDragStart: DragEventHandler<HTMLDivElement> = (event) => {
    event.dataTransfer.setData("job", JSON.stringify(data));
    return true;
    // event.dataTransfer.dropEffect = "copy";
  };

  //const coverImage = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${data.file_path}`;
  const coverImage =
    data.type === "video"
      ? data.metadata?.start_frame_url || data?.metadata?.end_frame_url
      : mediaUrl;

  return (
    <div
      className={cn(
        "flex items-start space-x-2 py-2 w-full px-4 hover:bg-accent transition-all",
        className,
      )}
      {...props}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(data);
      }}
      draggable={
        draggable &&
        (data.source_type === "uploaded" ||
          (data.source_type === "generated" &&
            data.metadata &&
            "status" in data.metadata &&
            data.metadata.status === "completed"))
      }
      onDragStart={handleOnDragStart}
    >
      {!!draggable && (
        <div
          className={cn(
            "flex items-center h-full cursor-grab text-muted-foreground",
            {
              "text-muted":
                data?.metadata &&
                "status" in data.metadata &&
                data.metadata.status !== "completed",
            },
          )}
        >
          <GripVerticalIcon className="w-4 h-4" />
        </div>
      )}
      <div className="w-16 h-16 aspect-square relative rounded overflow-hidden border border-transparent hover:border-accent bg-accent transition-all">
        {data?.metadata &&
        "status" in data.metadata &&
        data.metadata.status === "completed" ? (
          <>
            {(data.type === "image" || data.type === "video") &&
              (coverImage ? (
                <div className="w-full h-full flex items-center justify-center top-0 left-0 absolute p-2 z-50">
                  <img
                    src={coverImage as string}
                    alt="Generated media"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center top-0 left-0 absolute p-2 z-50">
                  {data.type === "image" ? (
                    <ImageIcon className="w-7 h-7 text-muted-foreground" />
                  ) : (
                    <VideoIcon className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>
              ))}
            {data.type === "audio" && (
              <div className="w-full h-full flex items-center justify-center top-0 left-0 absolute p-2 z-50">
                <MusicIcon className="w-7 h-7 text-muted-foreground" />
              </div>
            )}
            {data.type === "voiceover" && (
              <div className="w-full h-full flex items-center justify-center top-0 left-0 absolute p-2 z-50">
                <MicIcon className="w-7 h-7 text-muted-foreground" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center text-muted-foreground">
            {data?.metadata && "status" in data.metadata && (
              <>
                {data.metadata.status === "running" && (
                  <LoadingIcon className="w-8 h-8" />
                )}
                {data.metadata.status === "pending" && (
                  <HourglassIcon className="w-8 h-8 animate-spin ease-in-out delay-700 duration-1000" />
                )}
                {data.metadata.status === "failed" && (
                  <CircleXIcon className="w-8 h-8 text-rose-700" />
                )}
              </>
            )}
          </div>
        )}
        {data.source_type !== "generated" && (
          <>
            {(data.type === "image" || data.type === "video") &&
              (coverImage ? (
                <div className="w-full h-full flex items-center justify-center top-0 left-0 absolute p-2 z-50">
                  <img
                    src={coverImage as string}
                    alt="Generated media"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center top-0 left-0 absolute p-2 z-50">
                  {data.type === "image" ? (
                    <ImageIcon className="w-7 h-7 text-muted-foreground" />
                  ) : (
                    <VideoIcon className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>
              ))}
            {data.type === "audio" && (
              <div className="w-full h-full flex items-center justify-center top-0 left-0 absolute p-2 z-50">
                <MusicIcon className="w-7 h-7 text-muted-foreground" />
              </div>
            )}
            {data.type === "voiceover" && (
              <div className="w-full h-full flex items-center justify-center top-0 left-0 absolute p-2 z-50">
                <MicIcon className="w-7 h-7 text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex flex-col h-full gap-1 flex-1">
        <div className="flex flex-col items-start justify-center">
          <div className="flex w-full justify-between">
            <h3 className="text-sm font-medium flex flex-row gap-1 items-center">
              {/* {createElement(trackIcons[data.mediaType], {
                className: "w-4 h-4 stroke-1",
              } as React.ComponentProps<
                (typeof trackIcons)[keyof typeof trackIcons]
              >)} */}
              <span>{data.source_type === "generated" ? "Job" : "File"}</span>
              <code className="text-muted-foreground">#{mediaId}</code>
            </h3>
            {data?.metadata &&
              "status" in data.metadata &&
              data.metadata.status !== "completed" && (
                <Badge
                  variant="outline"
                  className={cn({
                    "text-rose-700": data.metadata.status === "failed",
                    "text-sky-500": data.metadata.status === "running",
                    "text-muted-foreground": data.metadata.status === "pending",
                  })}
                >
                  {data.metadata.status}
                </Badge>
              )}
          </div>
          <p className="opacity-40 text-sm line-clamp-1 ">
            {data?.metadata &&
              "input" in data.metadata &&
              data.metadata.input?.prompt}
          </p>
        </div>
        <div className="flex flex-row gap-2 justify-between">
          <span className="text-xs text-muted-foreground">
            {/* {formatDistanceToNow(data.createdAt, { addSuffix: true })} */}
          </span>
        </div>
      </div>
    </div>
  );
}

type MediaItemsPanelProps = {
  supabase: SupabaseClient;
  data: MediaItem[];
  mediaType: string;
  setSelectedMedia: Dispatch<SetStateAction<MediaItem | null>>;
  project: VideoProject;
} & HTMLAttributes<HTMLDivElement>;

export function MediaItemPanel({
  className,
  data,
  mediaType,
  supabase,
  setSelectedMedia,
  project
}: MediaItemsPanelProps) {
  const setSelectedMediaId = useVideoProjectStore((s) => s.setSelectedMediaId);
  //const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>();
  const handleOnOpen = (item: MediaItem) => {
    setSelectedMedia(item);
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden divide-y divide-border",
        className,
      )}
    >
      {data
        .filter((media) => {
          if (mediaType === "all") return true;
          return media.type === mediaType;
        })
        .map((media) => (
          <Fragment key={media.id}>
            <MediaItemRow
              data={media}
              onOpen={handleOnOpen}
              supabase={supabase}
              project={project}
            />
          </Fragment>
        ))}
    </div>
  );
}
