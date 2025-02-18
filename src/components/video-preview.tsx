// #region IMPORTS
import { EMPTY_VIDEO_COMPOSITION, VideoCompositionData } from "@/data/queries";
import {
  type MediaItem,
  PROJECT_PLACEHOLDER,
  TRACK_TYPE_ORDER,
  type VideoKeyFrame,
  type VideoProject,
  type VideoTrack,
} from "@/data/schema";
import { useVideoProjectStore } from "@/data/store";
import { resolveDuration } from "@/lib/utils";
import { Player, type PlayerRef } from "@remotion/player";
import { preloadVideo, preloadAudio } from "@remotion/preload";
import { useCallback, useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  Sequence,
  Video,
} from "remotion";
import { throttle } from "throttle-debounce";
import { Button } from "./ui/button";
import { DownloadIcon } from "lucide-react";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
// #endregion

// #region INTERFACE VIDEOCOMP
interface VideoCompositionProps {
  project: VideoProject;
  tracks: VideoTrack[];
  frames: Record<number, VideoKeyFrame>;
  mediaItems: Record<string, MediaItem>;
}

const FPS = 30;
const DEFAULT_DURATION = 5;
const VIDEO_WIDTH = 1024;
const VIDEO_HEIGHT = 720;
// #endregion

// #region VIDEO COMPOSITION
export const VideoComposition: React.FC<VideoCompositionProps> = ({
  project,
  tracks,
  frames,
  mediaItems,
}) => {
  const sortedTracks = [...tracks].sort((a, b) => {
    return TRACK_TYPE_ORDER[a.type] - TRACK_TYPE_ORDER[b.type];
  });

  return (
    <Composition
      id={project.id}
      component={MainComposition as any}
      durationInFrames={DEFAULT_DURATION * FPS}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={{
        project,
        tracks: sortedTracks,
        frames: Object.values(frames),
        mediaItems,
      }}
    />
  );
};
// #endregion

// #region MAIN COMPOSITION
const MainComposition: React.FC<VideoCompositionProps> = ({
  tracks,
  frames,
  mediaItems,
}) => {
  return (
    <AbsoluteFill>
      {tracks.map((track) => (
        <Sequence key={track.id}>
          {track.type === "video" && (
            <VideoTrackSequence
              track={track}
              frames={Object.values(frames)}
              mediaItems={mediaItems}
            />
          )}
          {(track.type === "audio" || track.type === "voiceover") && (
            <AudioTrackSequence
              track={track}
              frames={Object.values(frames)}
              mediaItems={mediaItems}
            />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
// #endregion

// #region INTERFACE TRACKSEQUENCE
interface TrackSequenceProps {
  track: VideoTrack;
  frames: VideoKeyFrame[];
  mediaItems: Record<string, MediaItem>;
}
// #endregion

// #region VIDEO TRACK SEQUENCE
const VideoTrackSequence: React.FC<TrackSequenceProps> = ({
  frames,
  mediaItems,
}) => {
  return (
    <AbsoluteFill>
      {frames.map((frame) => {
        const media = mediaItems[frame.asset_id];
        if (!media /* || media.status !== "completed" */) return null;

        const mediaUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${media.file_path}`;
        if (!mediaUrl) return null;

        const duration = frame.duration || resolveDuration(media) || 5000;
        const durationInFrames = Math.floor(duration / (1000 / FPS));

        return (
          <Sequence
            key={frame.id}
            from={Math.floor(frame.timestamp / (1000 / FPS))}
            durationInFrames={durationInFrames}
            premountFor={3000}
          >
            {media.type === "video" && <Video src={mediaUrl} />}
            {media.type === "image" && (
              <Img src={mediaUrl} style={{ objectFit: "cover" }} />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
// #endregion

// #region AUDIO TRACK SEQUENCE
const AudioTrackSequence: React.FC<TrackSequenceProps> = ({
  frames,
  mediaItems,
}) => {
  return (
    <>
      {frames.map((frame) => {
        const media = mediaItems[frame.asset_id];
        if (!media /* || media.status !== "completed" */) return null;

        const audioUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${media.file_path}`;
        if (!audioUrl) return null;

        const duration = frame.duration || resolveDuration(media) || 5000;
        const durationInFrames = Math.floor(duration / (1000 / FPS));

        return (
          <Sequence
            key={frame.id}
            from={Math.floor(frame.timestamp / (1000 / FPS))}
            durationInFrames={durationInFrames}
            premountFor={3000}
          >
            <Audio src={audioUrl} />
          </Sequence>
        );
      })}
    </>
  );
};
// #endregion

// #region TYPES
type VideoPreviewProps = {
  project: VideoProject | null;
  supabase: SupabaseClient;
  user: User | null;
  realtime: boolean;
};
// #endregion

// #region MAIN
export default function VideoPreview({
  project,
  supabase,
  user,
  realtime,
  ...props
}: VideoPreviewProps) {
  // #region setStates
  if (!project) {
    project = PROJECT_PLACEHOLDER;
  }
  const projectId = project.id;
  const [isCompositionLoading, setIsCompositionLoading] = useState<
    boolean | undefined
  >(false);
  const [composition, setComposition] = useState<VideoCompositionData>(
    EMPTY_VIDEO_COMPOSITION,
  );
  const setPlayer = useVideoProjectStore((s) => s.setPlayer);
  // #endregion

  // #region Get Compositon
  useEffect(() => {
    const getComposition = async () => {
      if (!projectId || !user) return;

      setIsCompositionLoading(true);
      try {
        const { data: tracks, error: tracksError } = await supabase
          .from("projects_assets")
          .select(`
            *, 
            keyframes(
              *,
              assets(*)
            )
          `)
          .eq("project_id", projectId);

        if (tracksError) {
          console.log("Error fetching tracks: ", tracksError);
          throw tracksError;
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

    if (project && project !== PROJECT_PLACEHOLDER) {
      getComposition();
    }
  }, [projectId, realtime]);
  const {
    tracks = [],
    frames = {} as Record<number, VideoKeyFrame>,
    mediaItems = {},
  } = composition;
  // #endregion

  // #region Get Media URL
  useEffect(() => {
    const mediaIds = Object.values(frames).map((f) => f.asset_id);
    for (const media of Object.values(mediaItems)) {
      if (media.source_type === "uploaded" && mediaIds.includes(media.id)) {
        const mediaUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${media.file_path}`;
        if (!mediaUrl) continue;
        if (media.type === "video" || media.type === "image") {
          preloadVideo(mediaUrl);
        }
        if (
          /* mediaUrl.indexOf("v2.") === -1 && */
          media.type === "audio" ||
          media.type === "voiceover"
        ) {
          preloadAudio(mediaUrl);
        }
      }
    }
  }, [frames, mediaItems]);
  // #endregion

  // #region Calculate Duration
  const calculateDuration = useCallback(() => {
    let maxTimestamp = 0;

    // Iterate directly over frame objects (not arrays)
    for (const frame of Object.values(frames)) {
      maxTimestamp = Math.max(maxTimestamp, Number(frame.timestamp));
    }

    // Add 5 seconds padding after the last frame
    return Math.max(DEFAULT_DURATION, Math.ceil((maxTimestamp + 5000) / 1000));
  }, [frames]);

  const duration = calculateDuration();
  // #endregion

  // #region Player State
  const setPlayerCurrentTimestamp = useVideoProjectStore(
    (s) => s.setPlayerCurrentTimestamp,
  );

  const setPlayerState = useVideoProjectStore((s) => s.setPlayerState);
  // Frame updates are super frequent, so we throttle the updates to the timestamp
  const updatePlayerCurrentTimestamp = useCallback(
    throttle(64, setPlayerCurrentTimestamp),
    [],
  );

  // Register events on the player
  const playerRef = useCallback(
    (player: PlayerRef) => {
      if (!player) return;
      setPlayer(player);
      player.addEventListener("play", (e) => {
        setPlayerState("playing");
      });
      player.addEventListener("pause", (e) => {
        setPlayerState("paused");
      });
      player.addEventListener("seeked", (e) => {
        const currentFrame = e.detail.frame;
        updatePlayerCurrentTimestamp(currentFrame / FPS);
      });
      player.addEventListener("frameupdate", (e) => {
        const currentFrame = e.detail.frame;
        updatePlayerCurrentTimestamp(currentFrame / FPS);
      });
    },
    [setPlayer, setPlayerState, updatePlayerCurrentTimestamp],
  );
  // #endregion

  // #region Export Button
  const setExportDialogOpen = useVideoProjectStore(
    (s) => s.setExportDialogOpen,
  );
  // #endregion

  // #region Main JSX
  return (
    <div className="flex-grow flex-1 h-full flex items-center justify-center bg-background-dark dark:bg-background-light relative">
      <Button
        className="absolute top-4 right-4"
        variant="default"
        onClick={() => setExportDialogOpen(true)}
        disabled={isCompositionLoading || tracks.length === 0}
      >
        <DownloadIcon className="w-4 h-4" />
        Export
      </Button>
      <div className="w-full mx-6 aspect-video max-h-[calc(100vh-25rem)]">
        <Player
          className="[&_video]:shadow-2xl"
          ref={playerRef}
          component={MainComposition as any}
          inputProps={{
            project,
            tracks,
            frames: Object.values(frames),
            mediaItems,
          }}
          durationInFrames={duration * FPS}
          fps={FPS}
          compositionWidth={VIDEO_WIDTH}
          compositionHeight={VIDEO_HEIGHT}
          style={{
            width: "100%",
            height: "100%",
          }}
          clickToPlay={true}
          showPosterWhenPaused={false}
          autoPlay={false}
          loop={false}
          controls={false}
          numberOfSharedAudioTags={10}
        />
      </div>
    </div>
  );
  // #endregion
}
// #endregion
