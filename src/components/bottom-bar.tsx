// #region IMPORTS
import {
    PROJECT_PLACEHOLDER,
    TRACK_TYPE_ORDER,
    VideoProject,
    type MediaItem,
    type VideoTrack,
} from "@/data/schema";
import { useVideoProjectStore } from "@/data/store";
import { cn, resolveDuration } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Dispatch,
    type DragEventHandler,
    SetStateAction,
    useMemo,
    useState,
} from "react";
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
    realtime: boolean;
    setRealtime: Dispatch<SetStateAction<boolean>>;
    setNewProjectItem: Dispatch<SetStateAction<MediaItem | null>>;
};
// #endregion

// #region MAIN
export default function BottomBar({
    project,
    supabase,
    user,
    realtime,
    setRealtime,
    setNewProjectItem,
    ...props
}: BottomBarProps) {
    // #region Const
    if (!project) {
        project = PROJECT_PLACEHOLDER;
    }
    const queryClient = useQueryClient();
    const projectId = project.id;
    const playerCurrentTimestamp = useVideoProjectStore(
        (s) => s.playerCurrentTimestamp,
    );
    const formattedTimestamp =
        (playerCurrentTimestamp < 10 ? "0" : "") +
        playerCurrentTimestamp.toFixed(2);
    const minTrackWidth = `${((2 / 30) * 100).toFixed(2)}%`;
    const [dragOverTracks, setDragOverTracks] = useState(false);

    const setProjectDialogOpen = useVideoProjectStore(
        (s) => s.setProjectDialogOpen,
    );
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
    };
    // #endregion

    // #region Add Track
    const addToTrack = useMutation({
        mutationFn: async (media: MediaItem) => {
            try {
                if (!user) {
                    toast({
                        title: "Cannot drop asset",
                        description: "Create or choose a project to continue",
                    });
                    return;
                }

                if (!project.id) {
                    setProjectDialogOpen(true);
                    setNewProjectItem(media);
                    return;
                }

                const { data: tracks, error: trakcsErr } = await supabase
                    .from("projects_assets")
                    .select("*")
                    .eq("project_id", project.id);

                if (trakcsErr) {
                    console.log("Error fetching keyframes: ", trakcsErr);
                    throw trakcsErr;
                }

                const trackType = media.type === "image" ? "video" : media.type;
                let track = tracks.find((t) => t.type === trackType);
                if (!track) {
                    const { data: newTrack, error: newTrackErr } = await supabase
                        .from("projects_assets")
                        .insert([
                            {
                                project_id: project.id,
                                asset_id: media.id,
                                type: trackType,
                                label: media.type,
                                locked: true,
                            },
                        ])
                        .select()
                        .single();

                    if (newTrackErr) {
                        console.log("Error adding track: ", newTrackErr);
                        throw newTrackErr;
                    }

                    track = newTrack;
                }

                const { data: keyframes, error: keyframesError } = await supabase
                    .from("keyframes")
                    .select("*")
                    .eq("track_id", track.id)
                    .order("timestamp", { ascending: true });

                if (keyframesError) {
                    console.log("Error fetching keyframes: ", keyframesError);
                    throw keyframesError;
                }

                const lastKeyframe = keyframes?.reduce(
                    (acc, frame) =>
                        frame.timestamp + frame.duration > acc.timestamp + acc.duration
                            ? frame
                            : acc,
                        { timestamp: 0, duration: 0 },
                );

                const duration = resolveDuration(media) ?? 5000;

                const baseData = {
                    track_id: track.id,
                    timestamp: lastKeyframe
                        ? lastKeyframe.timestamp + lastKeyframe.duration
                        : 0,
                    duration,
                    asset_id: media.id,
                };

                let insertData;
                if (media?.metadata && "input" in media.metadata) {
                    insertData = {
                        ...baseData,
                        type: media.metadata.input?.image_url ? "image" : "prompt",
                        prompt: media.metadata.input.prompt || "",
                        url: media.metadata.input.image_url?.url,
                    };
                } else if (media?.metadata && "description" in media.metadata) {
                    insertData = {
                    ...baseData,
                    type: media.type,
                    prompt: media.metadata.description || "",
                    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${media.file_path}`,
                };
                } else {
                    toast({
                        title: "Cannot drop asset",
                        description: "Error inserting media",
                    });
                    return;
                }

                const { data: newKeyframe, error: insertKeyframeError } = await supabase
                    .from("keyframes")
                    .insert(insertData)
                    .select()
                    .single();

                if (insertKeyframeError) {
                    console.log("Error inserting keyframes: ", insertKeyframeError);
                    throw insertKeyframeError;
                }

                return newKeyframe;
            } catch (error) {
                console.error("An error occurred: ", error);
                toast({
                    title: "Error",
                    description: "An unexpected error occurred. Please try again.",
                });
                throw error;
            }
        },
        onSuccess: (data) => {
            if (!data) return;
            setRealtime(!realtime);
            refreshVideoCache(queryClient, projectId);
        },
    });
    // #endregion

    // #region New Fetch Tracks
    const { data: tracks = [] } = useQuery({
        queryKey: queryKeys.projectTracks(projectId),
        queryFn: async () => {
            if (!projectId || !user) return [];

            const { data, error } = await supabase
                .from("projects_assets")
                .select("*, keyframes(*)")
                .eq("project_id", projectId);

            if (error) {
                console.log("Error fetching tracks:", error);
                throw error;
            }

            return (data as VideoTrack[]).toSorted(
                (a, b) => TRACK_TYPE_ORDER[a.type] - TRACK_TYPE_ORDER[b.type],
            );
        },
        enabled: !!projectId,
    });
    // #endregio

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
            audio:
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
                                supabase={supabase}
                                user={user}
                                realtime={realtime}
                                setRealtime={setRealtime}
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
