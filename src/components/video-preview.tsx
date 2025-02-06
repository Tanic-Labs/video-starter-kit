// #region IMPORTS
import { db } from "@/data/db";
import {
  EMPTY_VIDEO_COMPOSITION,
  useProject,
  useVideoComposition,
} from "@/data/queries";
import {
  type MediaItem,
  PROJECT_PLACEHOLDER,
  TRACK_TYPE_ORDER,
  type VideoKeyFrame,
  type VideoProject,
  type VideoTrack,
} from "@/data/schema";
import { useProjectId, useVideoProjectStore } from "@/data/store";
import { resolveDuration, resolveMediaUrl } from "@/lib/utils";
import { Player, type PlayerRef } from "@remotion/player";
import { preloadVideo, preloadAudio } from "@remotion/preload";
import { useCallback, useEffect } from "react";
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
// #endregion

// #region INTERFACE VIDEOCOMP
interface VideoCompositionProps {
  project: VideoProject;
  tracks: VideoTrack[];
  frames: Record<string, VideoKeyFrame[]>;
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
        frames,
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
              frames={frames[track.id] || []}
              mediaItems={mediaItems}
            />
          )}
          {(track.type === "audio" || track.type === "voiceover") && (
            <AudioTrackSequence
              track={track}
              frames={frames[track.id] || []}
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
// #endregon

// #region VIDEO TRACK SEQUENCE
const VideoTrackSequence: React.FC<TrackSequenceProps> = ({
  frames,
  mediaItems,
}) => {
  return (
    <AbsoluteFill>
      {frames.map((frame) => {
        const media = mediaItems[frame.data.mediaId];
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
        const media = mediaItems[frame.data.mediaId];
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
};
// #endregion

// #region MAIN
export default function VideoPreview({
  project,
  supabase,
  user,
  ...props
}: VideoPreviewProps) {
  // #region Const & Values
  if (!project) {
    project = PROJECT_PLACEHOLDER;
  }
  const projectId = project.id;
  const setPlayer = useVideoProjectStore((s) => s.setPlayer);

  const {
    data: composition = EMPTY_VIDEO_COMPOSITION,
    isLoading: isCompositionLoading,
  } = useVideoComposition(projectId);
  const { tracks = [], frames = {}, mediaItems = {} } = composition;
  // Sustituir useVideoComposition por queries a supabase y agregar a composition
  // #endregion

  // #region States & Effects
  useEffect(() => {
    const mediaIds = Object.values(frames)
      .flat()
      .flatMap((f) => f.data.mediaId);
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
  // Calculate the effective duration based on the latest keyframe
  const calculateDuration = useCallback(() => {
    let maxTimestamp = 0;
    for (const trackFrames of Object.values(frames)) {
      for (const frame of trackFrames) {
        maxTimestamp = Math.max(maxTimestamp, frame.timestamp);
      }
    }
    // Add 5 seconds padding after the last frame
    return Math.max(DEFAULT_DURATION, Math.ceil((maxTimestamp + 5000) / 1000));
  }, [frames]);

  const duration = calculateDuration();

  const setPlayerCurrentTimestamp = useVideoProjectStore(
    (s) => s.setPlayerCurrentTimestamp,
  );
  // #endregion

  // #region Player State
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
          component={MainComposition}
          inputProps={{
            project,
            tracks,
            frames,
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
        />
      </div>
    </div>
  );
  // #endregion
}
// #endregion
