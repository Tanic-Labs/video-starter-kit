// #region IMPORTS
import { db } from "@/data/db";
import {
  queryKeys,
  refreshVideoCache,
  useProjectMediaItems,
} from "@/data/queries";
import type {
  MediaItem,
  VideoKeyFrame,
  VideoProject,
  VideoTrack,
} from "@/data/schema";
import { cn, resolveDuration, resolveMediaUrl, trackIcons } from "@/lib/utils";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";
import {
  type HTMLAttributes,
  type MouseEventHandler,
  createElement,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { WithTooltip } from "../ui/tooltip";
import { useProjectId, useVideoProjectStore } from "@/data/store";
import { fal } from "@/lib/fal";
import { SupabaseClient, User } from "@supabase/supabase-js";
// #endregion

// #region TYPE VIDEO TRACK ROW
type VideoTrackRowProps = {
  data: VideoTrack;
  supabase: SupabaseClient;
  user: User | null;
} & HTMLAttributes<HTMLDivElement>;
// #endregion

// #region VIDEO TRACK ROW
export function VideoTrackRow({
  data,
  supabase,
  user,
  ...props
}: VideoTrackRowProps) {
  // #region Get Framses
  const { data: keyframes = [] } = useQuery({
    queryKey: ["frames", data],
    queryFn: async () => {
      const { data: keyframesData, error } = await supabase
        .from("keyframes")
        .select("*")
        .eq("track_id", data.id)
        .order("timestamp", { ascending: true });

      if (error) {
        console.log("Error fetchin track in VTR: ", error);
        throw error;
      }
      return keyframesData;
    },
    enabled: Boolean(
      data?.id && !["video", "audio", "voiceover"].includes(data.id),
    ),
  });
  const mediaType = useMemo(() => keyframes[0]?.type, [keyframes]);
  // #endregion

  // #region Video Track Row JSX
  return (
    <div
      className={cn(
        "relative w-full timeline-container",
        "flex flex-col select-none rounded overflow-hidden shrink-0",
        {
          "min-h-[64px]": mediaType,
          "min-h-[56px]": !mediaType,
        },
      )}
      {...props}
    >
      {keyframes.map((frame) => (
        <VideoTrackView
          key={frame.id}
          className="absolute top-0 bottom-0"
          style={{
            left: `${(frame.timestamp / 10 / 30).toFixed(2)}%`,
            width: `${(frame.duration / 10 / 30).toFixed(2)}%`,
          }}
          track={data}
          frame={frame}
          supabase={supabase}
        />
      ))}
    </div>
  );
  // #endregion
}
// #endregion

// #region TYPE AUDIO WAVEFORM
type AudioWaveformProps = {
  data: MediaItem;
};
// #endregion

// #region AUDIO WAVEFORM
function AudioWaveform({ data }: AudioWaveformProps) {
  // #region Get Waveform
  const { data: waveform = [] } = useQuery({
    queryKey: ["media", "waveform", data.id],
    queryFn: async () => {
      if (data.metadata?.waveform && Array.isArray(data.metadata.waveform)) {
        return data.metadata.waveform;
      }
      const { data: waveformInfo } = await fal.subscribe(
        "fal-ai/ffmpeg-api/waveform",
        {
          input: {
            media_url: resolveMediaUrl(data),
            points_per_second: 5,
            precision: 3,
          },
        },
      );
      await db.media.update(data.id, {
        ...data,
        metadata: {
          ...data.metadata,
          waveform: waveformInfo.waveform,
        },
      });
      return waveformInfo.waveform as number[];
    },
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
  });
  // #endregion

  // #region Waveform Size
  const svgWidth = waveform.length * 3;
  const svgHeight = 100;
  // #endregion

  // #region Audio Waveform JSX
  return (
    <div className="h-full flex items-center">
      <svg
        width="100%"
        height="80%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="none"
      >
        <title>Audio Waveform</title>
        {waveform.map((v, index) => {
          const amplitude = Math.abs(v);
          const height = Math.max(amplitude * svgHeight, 2);
          const x = index * 3;
          const y = (svgHeight - height) / 2;

          return (
            <rect
              key={index}
              x={x}
              y={y}
              width="2"
              height={height}
              className="fill-black/40"
              rx="4"
            />
          );
        })}
      </svg>
    </div>
  );
  // #endregion
}
// #endregion

// #region TYPE VIDEO TRACK VIEW
type VideoTrackViewProps = {
  track: VideoTrack;
  frame: VideoKeyFrame;
  supabase: SupabaseClient;
} & HTMLAttributes<HTMLDivElement>;

interface ProjectsAssetsResponse {
  assets: MediaItem;
}
// #endregion

// #region VIDEO TRACK VIEW
export function VideoTrackView({
  className,
  track,
  frame,
  supabase,
  ...props
}: VideoTrackViewProps) {
  // #region Const & Values
  const queryClient = useQueryClient();

  // #region Delete Function
  const deleteKeyframe = useMutation({
    //mutationFn: () => db.kekyFrames.delete(frame.id), // Replace a delete en supabase
    mutationFn: async () => {
      const trackID = frame.track_id;
      const { data: deleteKeySuccess, error: deleteKeyError } = await supabase
        .from("keyframes")
        .delete()
        .eq("track_id", trackID);

      if (deleteKeyError) {
        console.log("Error deleting keyframes: ", deleteKeyError);
        throw deleteKeyError;
      }

      const { data: deleteTrackSuccess, error: deleteTrackError } =
        await supabase.from("projects_assets").delete().eq("id", trackID);

      if (deleteTrackError) {
        console.log("Error deleting Track: ", deleteTrackError);
      }
    },
    onSuccess: () => refreshVideoCache(queryClient, track.projectId), // Corregir a real project id
  });
  const handleOnDelete = async () => {
    deleteKeyframe.mutate();
  };
  // #endregion

  const isSelected = useVideoProjectStore(
    (
      state, //Crear estado de slected
    ) => state.selectedKeyframes.includes(frame.id),
  );
  const selectKeyframe = useVideoProjectStore((state) => state.selectKeyframe);
  const handleOnClick: MouseEventHandler = (e) => {
    if (e.detail > 1) {
      return;
    }
    selectKeyframe(frame.id);
  };

  //@ts-ignore
  const projectId = track && track.project_id ? track.project_id : "";
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    const fetchMediaItems = async () => {
      const { data, error } = await supabase
        .from("projects_assets")
        .select("assets(*)")
        .eq("project_id", projectId)
        .returns<ProjectsAssetsResponse[]>();

      if (error) {
        console.log(error);
        throw error;
      }

      const mappedItems = data.map(
        (item) =>
          ({
            id: item.assets.id,
            user_id: item.assets.user_id,
            type: item.assets.type,
            source_type: item.assets.source_type,
            file_path: item.assets.file_path,
            created_at: item.assets.created_at,
            metadata: item.assets.metadata,
          }) as MediaItem,
      );

      setMediaItems(mappedItems);
    };
    if (projectId) fetchMediaItems();
  }, [projectId]);

  const media = mediaItems.find((item) => item.id === frame.asset_id);
  // #endregion

  // #region Get Media Url
  //const mediaUrl = resolveMediaUrl(media); // obtener url real del objeto en suapbase
  const mediaUrl =
    media && media.source_type === "uploaded"
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${media.file_path}`
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/7f4041c4-c378-4c1e-a47f-8b5389a8a322/images/0406c906-9e24-4ec2-9e2e-95ce3aab039a.png`;

  const imageUrl = useMemo(() => {
    if (!media) return;
    if (media.type === "image" || media.type === "video") {
      return mediaUrl;
    }
    /* if (media.type === "video") { // Ver como obtener e insertar estos datos en video
      return (
        media.input?.image_url ||
        media.metadata?.start_frame_url ||
        media.metadata?.end_frame_url
      );
    } */
    return undefined;
  }, [media]);
  // #endregion

  const label = media?.type ?? "unknown"; // Mover
  const trackRef = useRef<HTMLDivElement>(null); // Para que es esto?

  // TODO improve missing data
  if (!media) return null;

  // #region Calculate Bounds
  const calculateBounds = () => {
    // Checar como funciona
    const timelineElement = document.querySelector(".timeline-container");
    const timelineRect = timelineElement?.getBoundingClientRect();
    const trackElement = trackRef.current;
    const trackRect = trackElement?.getBoundingClientRect();

    if (!timelineRect || !trackRect || !trackElement)
      return { left: 0, right: 0 };

    const previousTrack = trackElement?.previousElementSibling;
    const nextTrack = trackElement?.nextElementSibling;

    const leftBound = previousTrack
      ? previousTrack.getBoundingClientRect().right - (timelineRect?.left || 0)
      : 0;
    const rightBound = nextTrack
      ? nextTrack.getBoundingClientRect().left -
        (timelineRect?.left || 0) -
        trackRect.width
      : timelineRect.width - trackRect.width;

    return {
      left: leftBound,
      right: rightBound,
    };
  };
  // #endregion

  // #region Handle Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // verificar correcto funcionamiento de esta handler
    const trackElement = trackRef.current;
    if (!trackElement) return;
    const bounds = calculateBounds();
    const startX = e.clientX;
    const startLeft = trackElement.offsetLeft;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newLeft = startLeft + deltaX;

      if (newLeft < bounds.left) {
        newLeft = bounds.left;
      } else if (newLeft > bounds.right) {
        newLeft = bounds.right;
      }

      const timelineElement = trackElement.closest(".timeline-container");
      const parentWidth = timelineElement
        ? (timelineElement as HTMLElement).offsetWidth
        : 1;
      const newTimestamp = (newLeft / parentWidth) * 30;
      frame.timestamp = (newTimestamp < 0 ? 0 : newTimestamp) * 1000;

      trackElement.style.left = `${((frame.timestamp / 30) * 100) / 1000}%`;
      db.keyFrames.update(frame.id, { timestamp: frame.timestamp });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectPreview(projectId),
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };
  // #endregion

  // #region Hande Resize
  const handleResize = (
    // verificar correcto funcionamiento de esta handler
    e: React.MouseEvent<HTMLDivElement>,
    direction: "left" | "right",
  ) => {
    e.stopPropagation();
    const trackElement = trackRef.current;
    if (!trackElement) return;
    const startX = e.clientX;
    const startWidth = trackElement.offsetWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth + (direction === "right" ? deltaX : -deltaX);

      const minDuration = 1000;
      const maxDuration: number = resolveDuration(media) ?? 5000;

      const timelineElement = trackElement.closest(".timeline-container");
      const parentWidth = timelineElement
        ? (timelineElement as HTMLElement).offsetWidth
        : 1;
      let newDuration = (newWidth / parentWidth) * 30 * 1000;

      if (newDuration < minDuration) {
        newWidth = (minDuration / 1000 / 30) * parentWidth;
        newDuration = minDuration;
      } else if (newDuration > maxDuration) {
        newWidth = (maxDuration / 1000 / 30) * parentWidth;
        newDuration = maxDuration;
      }

      frame.duration = newDuration;
      trackElement.style.width = `${((frame.duration / 30) * 100) / 1000}%`;
    };

    const handleMouseUp = () => {
      frame.duration = Math.round(frame.duration / 100) * 100;
      trackElement.style.width = `${((frame.duration / 30) * 100) / 1000}%`;
      db.keyFrames.update(frame.id, { duration: frame.duration });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectPreview(projectId),
      });
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };
  // #endregion

  // #region Video Track View JSX
  return (
    <div
      ref={trackRef}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      aria-checked={isSelected}
      onClick={handleOnClick}
      className={cn(
        "flex flex-col border border-white/10 rounded-lg",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex flex-col select-none rounded overflow-hidden group h-full",
          {
            "bg-sky-600": track.type === "video",
            "bg-teal-500": track.type === "audio",
            "bg-indigo-500": track.type === "voiceover",
          },
        )}
      >
        <div className="p-0.5 pl-1 bg-black/10 flex flex-row items-center">
          <div className="flex flex-row gap-1 text-sm items-center font-semibold text-white/60 w-full">
            <div className="flex flex-row truncate gap-1 items-center">
              {createElement(trackIcons[track.type], {
                className: "w-5 h-5 text-white",
              } as React.ComponentProps<
                (typeof trackIcons)[typeof track.type]
              >)}
              <span className="line-clamp-1 truncate text-sm mb-[2px] w-full ">
                {(media?.metadata &&
                  "input" in media.metadata &&
                  media.metadata.input?.prompt) ||
                  label}
              </span>
            </div>
            <div className="flex flex-row shrink-0 flex-1 items-center justify-end">
              <WithTooltip tooltip="Remove content">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-black/5 group-hover:text-white"
                  onClick={handleOnDelete}
                >
                  <TrashIcon className="w-3 h-3 text-white" />
                </button>
              </WithTooltip>
            </div>
          </div>
        </div>
        <div
          className="p-px flex-1 items-center bg-repeat-x h-full max-h-full overflow-hidden relative"
          style={
            imageUrl
              ? {
                  background: `url(${imageUrl})`,
                  backgroundSize: "auto 100%",
                }
              : undefined
          }
        >
          {(media.type === "audio" || media.type === "voiceover") && (
            <AudioWaveform data={media} />
          )}
          <div
            className={cn(
              "absolute right-0 z-50 top-0 bg-black/20 group-hover:bg-black/40",
              "rounded-md bottom-0 w-2 m-1 p-px cursor-ew-resize backdrop-blur-md text-white/40",
              "transition-colors flex flex-col items-center justify-center text-xs tracking-tighter",
            )}
            onMouseDown={(e) => handleResize(e, "right")}
          >
            <span className="flex gap-[1px]">
              <span className="w-px h-2 rounded bg-white/40" />
              <span className="w-px h-2 rounded bg-white/40" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
  // #endregion
}
// #endregion
