// #region IMPORTS
import { db } from "@/data/db";
import {
  PROJECT_PLACEHOLDER,
  TRACK_TYPE_ORDER,
  VideoProject,
  type MediaItem,
  type VideoTrack,
} from "@/data/schema";
import { useProjectId, useVideoProjectStore } from "@/data/store";
import { cn, resolveDuration } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type DragEventHandler, useMemo, useState } from "react";
import { VideoControls } from "./video-controls";
import { TimelineRuler } from "./video/timeline";
import { VideoTrackRow } from "./video/track";
import { queryKeys, refreshVideoCache } from "@/data/queries";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
// #endregion

// #region TYPES
type BottomBarProps = {
  project: VideoProject | null;
  supabase: SupabaseClient;
  user: User | null;
};
// #endregion

// #region MAIN
export default function BottomBar({ 
  project,
  supabase,
  user,
  ...props 
}: BottomBarProps) {
  // #region Const
  if (!project) {
    project = PROJECT_PLACEHOLDER;
  }
  const queryClient = useQueryClient(); // Es sustituido por client
  const projectId = useProjectId(); // Este debe sustiuirse por project.id
  const playerCurrentTimestamp = useVideoProjectStore(
    (s) => s.playerCurrentTimestamp,
  );
  const formattedTimestamp =
    (playerCurrentTimestamp < 10 ? "0" : "") +
    playerCurrentTimestamp.toFixed(2);
  const minTrackWidth = `${((2 / 30) * 100).toFixed(2)}%`;
  const [dragOverTracks, setDragOverTracks] = useState(false);
  // #endregion

  // #region Drag Function
  const handleOnDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setDragOverTracks(true);
    const jobPayload = event.dataTransfer.getData("job");
    if (!jobPayload) return false;
    const job: MediaItem = JSON.parse(jobPayload);
    const jobComplete =
      job?.metadata &&
      "status" in job.metadata &&
      job.metadata.status === "completed";
    return jobComplete;
    //return job.metadata.status === "completed";
  };
  // #endregion

  // #region Add Track
  const addToTrack = useMutation({ // Sustituir por una funcion asyncrona
    mutationFn: async (media: MediaItem) => { 
      if (!project.id || !user) {
        toast({
          title: "Cannot drop asset",
          description: "Create or choose a project to continue",
        });
        return;
      }
      //const tracks = await db.tracks.tracksByProject(project.id); // Sustituir por un fetch de projects_assets
      const {data: tracks, error: trakcsErr} = await supabase
        .from('projects_assets')
        .select('*')
        .eq('project_id', project.id);
      
      if (trakcsErr) throw trakcsErr;
      
      const trackType = media.type === "image" ? "video" : media.type;
      let track = tracks.find((t) => t.type === trackType);
      /* if (!track) { // sustiur por un insert & select a projects_assets
        const id = await db.tracks.create({
          projectId: project.id,
          type: trackType,
          label: media.type,
          locked: true,
        });
        const newTrack = await db.tracks.find(id.toString());
        if (!newTrack) return;
        track = newTrack;
      } */
      if (!track) {
        const {data: newTrack, error: newTrackErr} = await supabase
          .from('projects_assets')
          .insert([
            {
              project_id: project.id,
              asset_id: media.id,
              type: trackType,
              label: media.type,
              locked: true,
            }
          ])
          .select()

          if (newTrackErr) throw newTrackErr;

          track = newTrack;
      }
      
      //const keyframes = await db.keyFrames.keyFramesByTrack(track.id);
      const { data: keyframes, error: keyframesError } = await supabase
        .from('keyframes')
        .select('*')
        .eq('track_id', track.id)
        .order('timestamp', { ascending: true });

      if (keyframesError) {console.log(keyframesError)};
      

      /* const lastKeyframe = [...keyframes]
        .sort((a, b) => a.timestamp - b.timestamp)
        .reduce(
          (acc, frame) => {
            if (frame.timestamp + frame.duration > acc.timestamp + acc.duration)
              return frame;
            return acc;
          },
          { timestamp: 0, duration: 0 },
        ); */
      const lastKeyframe = keyframes?.reduce(
        (acc, frame) => 
          frame.timestamp + frame.duration > acc.timestamp + acc.duration 
            ? frame 
            : acc,
        { timestamp: 0, duration: 0 }
      );

      const duration = resolveDuration(media) ?? 5000; //gets media duration

      /* let newId;

      if (media?.metadata && "input" in media.metadata) {
        newId = await db.keyFrames.create({
          trackId: track.id,
          data: {
            mediaId: media.id,
            type: media.metadata.input?.image_url ? "image" : "prompt",
            prompt: media.metadata.input?.prompt || "",
            url: media.metadata.input?.image_url?.url,
          },
          timestamp: lastKeyframe
            ? lastKeyframe.timestamp + 1 + lastKeyframe.duration
            : 0,
          duration,
        });
      } else if (media.metadata && "description" in media.metadata) {
        newId = db.keyFrames.create({
          trackId: track.id,
          data: {
            mediaId: media.id,
            type: media.type ? "image" : "video",
            prompt: media.metadata.description || "",
            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${media.file_path}`,
          },
          timestamp: lastKeyframe
            ? lastKeyframe.timestamp + 1 + lastKeyframe.duration
            : 0,
          duration,
        });
      } else {
        toast({
          title: "Cannot drop asset",
          description: "Error inserting media",
        });
        return;
      }

      return db.keyFrames.find(newId.toString()); */
      const baseData = {
        track_id: track.id,
        timestamp: lastKeyframe 
          ? lastKeyframe.timestamp + lastKeyframe.duration + 1 
          : 0,
        duration,
        asset_id: media.id,
      };

      let insertData;
      if (media?.metadata && "input" in media.metadata) {
        insertData = {
          ...baseData,
          type: media.metadata.input?.image_url ? "image" : "prompt",
          prompt: media.metadata.input.prompt || '',
          url: media.metadata.input.image_url?.url
        };
      } else if (media?.metadata && "description" in media.metadata) {
        insertData = {
          ...baseData,
          type: media.type,
          prompt: media.metadata.description || '',
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${media.file_path}`
        };
      } else {
        toast({
          title: "Cannot drop asset",
          description: "Error inserting media",
        });
        return;
      }
      console.log(insertData);
      
      const { data: newKeyframe, error: insertKeyframeError } = await supabase
        .from('keyframes')
        .insert(insertData)
        .select()
        .single();

      if (insertKeyframeError) {console.log(insertKeyframeError)};

      return newKeyframe;
    },
    onSuccess: (data) => {
      if (!data) return;
      refreshVideoCache(queryClient, projectId);
    },
  });
  // #endregion

  // #region Fetch Tracks
  const { data: tracks = [] } = useQuery({
    queryKey: queryKeys.projectTracks(projectId),
    queryFn: async () => {
      const result = await db.tracks.tracksByProject(projectId);
      return result.toSorted(
        (a, b) => TRACK_TYPE_ORDER[a.type] - TRACK_TYPE_ORDER[b.type],
      );
    },
  });
  // #endregion

  // #region Type Of Tracks
  const trackObj: Record<string, VideoTrack> = useMemo(() => {
    return {
      video:
        tracks.find((t) => t.type === "video") ||
        ({
          id: "video",
          type: "video",
          label: "Video",
          locked: true,
          keyframes: [],
          projectId: projectId,
        } as VideoTrack),
      music:
        tracks.find((t) => t.type === "audio") ||
        ({
          id: "audio",
          type: "audio",
          label: "Audio",
          locked: true,
          keyframes: [],
          projectId: projectId,
        } as VideoTrack),
      voiceover:
        tracks.find((t) => t.type === "voiceover") ||
        ({
          id: "voiceover",
          type: "voiceover",
          label: "Voiceover",
          locked: true,
          keyframes: [],
          projectId: projectId,
        } as VideoTrack),
    };
  }, [tracks, projectId]);
  // #endregion

  // #region Drop Function
  const handleOnDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setDragOverTracks(false);
    const jobPayload = event.dataTransfer.getData("job");
    if (!jobPayload) return false;
    const job: MediaItem = JSON.parse(jobPayload);
    addToTrack.mutate(job);
    return true;
  };
  // #endregion

  // #region JSX MAIN
  return (
    <div className="border-t pb-2 border-border flex flex-col bg-background-light ">
      <div className="border-b border-border bg-background-dark px-2 flex flex-row gap-8 py-2 justify-between items-center flex-1">
        <div className="h-full flex flex-col justify-center px-4 bg-muted/50 rounded-md font-mono cursor-default select-none shadow-inner">
          <div className="flex flex-row items-baseline font-thin tabular-nums">
            <span className="text-muted-foreground">00:</span>
            <span>{formattedTimestamp}</span>
            <span className="text-muted-foreground/50 mx-2">/</span>
            <span className="text-sm opacity-50">
              <span className="text-muted-foreground">00:</span>30.00
            </span>
          </div>
        </div>
        <VideoControls />
      </div>
      <div
        className={cn(
          "min-h-64  max-h-72 h-full flex flex-row overflow-y-scroll transition-colors",
          {
            "bg-white/5": dragOverTracks,
          },
        )}
        onDragOver={handleOnDragOver}
        onDragLeave={() => setDragOverTracks(false)}
        onDrop={handleOnDrop}
      >
        <div className="flex flex-col justify-start w-full h-full relative">
          <div
            className="absolute z-[32] top-6 bottom-0 w-[2px] bg-white/30 ms-4"
            style={{
              left: `${((playerCurrentTimestamp / 30) * 100).toFixed(2)}%`,
            }}
          />
          <TimelineRuler className="z-30 pointer-events-none" />
          <div className="flex timeline-container flex-col h-full mx-4 mt-10 gap-2 z-[31] pb-2">
            {Object.values(trackObj).map((track, index) =>
              track ? (
                <VideoTrackRow
                  key={track.id}
                  data={track}
                  style={{
                    minWidth: minTrackWidth,
                  }}
                />
              ) : (
                <div
                  key={`empty-track-${index}`}
                  className="flex flex-row relative w-full h-full timeline-container"
                />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
  // #endregion
}
// #endregion
