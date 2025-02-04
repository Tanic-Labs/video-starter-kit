"use client";

import BottomBar from "@/components/bottom-bar";
import Header from "@/components/header";
import RightPanel from "@/components/right-panel";
import VideoPreview from "@/components/video-preview";
import { type MediaItem, PROJECT_PLACEHOLDER } from "@/data/schema";
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
import { createClient, User } from "@supabase/supabase-js";

type AppProps = {
  projectId: string;
  supabaseUrl: string;
  supabaseKey: string;
};

export function App({ projectId, supabaseUrl, supabaseKey }: AppProps) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const [supabaseClient] = useState(() => createPagesBrowserClient());
  const [keyDialog, setKeyDialog] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const initializeDevSession = async () => {
      // 1. Check for existing valid session first
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      setUser(user);
    };
    initializeDevSession();
  }, [supabaseClient]);

  const queryClient = useRef(new QueryClient()).current;
  const projectStore = useRef(
    createVideoProjectStore({
      projectId,
    }),
  ).current;
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

  const { toast } = useToast();

  useEffect(() => {
    toast({
      title: "Welcome!",
      description: "Happy to see you again.",
    });
  }, [toast]);

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
      const { data, error } = await supabase
        .from("assets") // Reemplaza con el nombre de tu tabla
        .select("*"); // Aquí puedes especificar las columnas que necesitas

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

  return (
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <VideoProjectStoreContext.Provider value={projectStore}>
          <div className="flex flex-col h-screen bg-background">
            <Header openKeyDialog={() => setKeyDialog(true)} />
            <main className="flex overflow-hidden h-full">
              <LeftPanel
                supabase={supabase}
                mediaItems={mediaItems}
                isLoading={isLoading}
                fetchData={fetchData}
                setSelectedMedia={setSelectedMedia}
              />
              <div className="flex flex-col flex-1">
                <VideoPreview />
                <BottomBar />
              </div>
              <RightPanel />
            </main>
          </div>
          <Toaster />
          <ProjectDialog
            open={projectDialogOpen}
            supabase={supabase}
            user={user}
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
            supabase={supabase}
            mediaItems={mediaItems}
            setMediaItems={setMediaItems}
          />
        </VideoProjectStoreContext.Provider>
      </QueryClientProvider>
    </ToastProvider>
  );
}
