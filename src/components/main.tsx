"use client";

// #region IMPORTS
import BottomBar from "@/components/bottom-bar";
import Header from "@/components/header";
import RightPanel from "@/components/right-panel";
import VideoPreview from "@/components/video-preview";
import { type MediaItem, VideoProject } from "@/data/schema";
import {
  VideoProjectStoreContext,
  createVideoProjectStore,
} from "@/data/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { useStore } from "zustand";
import { ProjectDialog } from "./project-dialog";
import { MediaGallerySheet } from "./media-gallery";
import { ToastProvider } from "./ui/toast";
import { Toaster } from "./ui/toaster";
import { ExportDialog } from "./export-dialog";
import LeftPanel from "./left-panel";
import { KeyDialog } from "./key-dialog";
import { useToast } from "@/hooks/use-toast";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { User } from "@supabase/supabase-js";
// #endregion

// #region TYPE
type AppProps = {
  projectId: string;
};
// #endregion

// #region MIAN
export function App({ projectId }: AppProps) {
  // #region States & Effects
  const [supabaseClient] = useState(() => createPagesBrowserClient());
  const [keyDialog, setKeyDialog] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [project, setProject] = useState<VideoProject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [realtime, setRealtime] = useState<boolean>(false);

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const initializeSession = async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      setUser(user);
    };
    initializeSession();
  }, [supabaseClient]);
  // #endregion

  // #region Other
  const queryClient = useRef(new QueryClient()).current;
  const projectStore = useRef(
    createVideoProjectStore({
      projectId,
    }),
  ).current;
  // #endregion

  // #region Open Modals
  const projectDialogOpen = useStore(projectStore, (s) => s.projectDialogOpen);
  const selectedMediaId = useStore(projectStore, (s) => s.selectedMediaId);
  const setSelectedMediaId = useStore(
    projectStore,
    (s) => s.setSelectedMediaId,
  );
  const handleOnSheetOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedMediaId(null);
    }
  };
  const isExportDialogOpen = useStore(projectStore, (s) => s.exportDialogOpen);
  const setExportDialogOpen = useStore(
    projectStore,
    (s) => s.setExportDialogOpen,
  );
  // #endregion

  // #region Toast
  const { toast } = useToast();

  useEffect(() => {
    toast({
      title: "Welcome!",
      description: "Happy to see you again.",
    });
  }, [toast]);
  // #endregion

  // #region FetchData
  async function fetchData() {
    setIsLoading(true);

    if (user) {
      const { data, error } = await supabaseClient
        .from("assets")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching data:", error.message);
        setIsLoading(false);
        return;
      } else {
        setMediaItems(data);
        setIsLoading(false);
      }
    } else {
      const { data, error } = await supabaseClient.from("assets").select("*");

      if (error) {
        console.error("Error fetching data:", error.message);
        setIsLoading(false);
      } else {
        setMediaItems(data);
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    fetchData();
  }, [user]);
  // #endregion

  // #region JSX
  return (
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <VideoProjectStoreContext.Provider value={projectStore}>
          <div className="flex flex-col h-screen bg-background">
            <Header openKeyDialog={() => setKeyDialog(true)} />
            <main className="flex overflow-hidden h-full">
              <LeftPanel
                supabase={supabaseClient}
                user={user}
                mediaItems={mediaItems}
                isLoading={isLoading}
                fetchData={fetchData}
                setSelectedMedia={setSelectedMedia}
                project={project}
              />
              <div className="flex flex-col flex-1">
                <VideoPreview
                  project={project}
                  supabase={supabaseClient}
                  user={user}
                  realtime={realtime}
                />
                <BottomBar
                  project={project}
                  supabase={supabaseClient}
                  user={user}
                  realtime={realtime}
                  setRealtime={setRealtime}
                />
              </div>
              <RightPanel supabase={supabaseClient} user={user} />
            </main>
          </div>
          <Toaster />
          <ProjectDialog
            open={projectDialogOpen}
            supabase={supabaseClient}
            user={user}
            project={project}
            setProject={setProject}
          />
          <ExportDialog
            open={isExportDialogOpen}
            onOpenChange={setExportDialogOpen}
          />
          <KeyDialog
            open={keyDialog}
            onOpenChange={(open) => setKeyDialog(open)}
          />
          <MediaGallerySheet
            open={selectedMedia !== null}
            onOpenChange={handleOnSheetOpenChange}
            media={selectedMedia ?? null}
            setSelectedMedia={setSelectedMedia}
            supabase={supabaseClient}
            mediaItems={mediaItems}
            setMediaItems={setMediaItems}
          />
        </VideoProjectStoreContext.Provider>
      </QueryClientProvider>
    </ToastProvider>
  );
  // #endregion
}
// #endregion
