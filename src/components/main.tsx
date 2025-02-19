"use client";

// #region IMPORTS
import BottomBar from "@/components/bottom-bar";
import Header from "@/components/header";
import RightPanel from "@/components/right-panel";
import VideoPreview from "@/components/video-preview";
import { AspectRatio, type MediaItem, VideoProject } from "@/data/schema";
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
import {
  createClientComponentClient,
  createPagesBrowserClient,
} from "@supabase/auth-helpers-nextjs";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

// #region TYPE
type AppProps = {
  //projectId: string;
  session: any;
};
// #endregion

// #region MIAN
export function App({ /* projectId, */ session }: AppProps) {
  // #region States & Effects
  const supabase = createClientComponentClient();
  const [supabaseClient] = useState(() => createPagesBrowserClient());
  const [keyDialog, setKeyDialog] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [project, setProject] = useState<VideoProject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [realtime, setRealtime] = useState<boolean>(false);
  const [newProjectItem, setNewProjectItem] = useState<MediaItem | null>(null);
  const [ratio, setRatio] = useState<AspectRatio | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error("Error fetching user session: ", error);
        toast({
          title: "Error",
          description: "Unable to fetch user session. Please try again.",
        });
      }
    };
    initializeSession();
  }, [supabaseClient]);
  // #endregion

  // #region Other
  const queryClient = useRef(new QueryClient()).current;
  const projectStore = useRef(
    createVideoProjectStore({
      //projectId
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
    try {
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
      } /* else {
        const { data, error } = await supabaseClient.from("assets").select("*");

        if (error) {
          console.error("Error fetching data:", error.message);
          setIsLoading(false);
        } else {
          setMediaItems(data);
          setIsLoading(false);
        }
      } */
    } catch (error) {
      console.error("An error occurred while fetching data: ", error);
      toast({
        title: "Error",
        description: "Unable to fetch data. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      const signInWithToken = async () => {
        try {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            console.error("Error setting session:", error);
            return;
          }

          // Limpiar la URL después de iniciar sesión
          window.location.hash = "";
          router.push("/");
        } catch (error) {
          console.error("Error al iniciar sesión:", error);
        }
      };

      signInWithToken();
    }
  }, []);

  useEffect(() => {
    if (project) {
      console.log(project)
      setRatio(project.aspectRatio);
    }
  }, [project]);

  return (
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <VideoProjectStoreContext.Provider value={projectStore}>
          <div className="flex flex-col h-screen bg-background">
            <Header
              openKeyDialog={() => setKeyDialog(true)}
              session={session}
            />
            <main className="flex overflow-hidden h-full">
              <LeftPanel
                supabase={supabaseClient}
                user={user}
                mediaItems={mediaItems}
                isLoading={isLoading}
                fetchData={fetchData}
                setSelectedMedia={setSelectedMedia}
                project={project}
                ratio={ratio}
                setRatio={setRatio}
              />
              <div className="flex flex-col flex-1">
                <VideoPreview
                  project={project}
                  supabase={supabaseClient}
                  user={user}
                  realtime={realtime}
                  ratio={ratio}
                />
                <BottomBar
                  project={project}
                  supabase={supabaseClient}
                  user={user}
                  realtime={realtime}
                  setRealtime={setRealtime}
                  setNewProjectItem={setNewProjectItem}
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
            setRatio={setRatio}
            newProjectItem={newProjectItem}
            setNewProjectItem={setNewProjectItem}
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
