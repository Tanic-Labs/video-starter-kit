"use client";

// #region IMPORTS
import type { VideoProject, AspectRatio, MediaItem } from "@/data/schema";
import { useVideoProjectStore } from "@/data/store";
import { useToast } from "@/hooks/use-toast";
import { createProjectSuggestion } from "@/lib/project";
import { cn, rememberLastProjectId } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileVideoIcon, FolderOpenIcon, WandSparklesIcon } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Logo } from "./logo";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";
import { Textarea } from "./ui/textarea";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { WithTooltip } from "./ui/tooltip";
import { LoadingIcon } from "./ui/icons";
// #endregion

// #region TYPES
type ProjectDialogProps = {
  supabase: SupabaseClient;
  user: User | null;
  project: VideoProject | null;
  setProject: Dispatch<SetStateAction<VideoProject | null>>;
  setRatio: Dispatch<SetStateAction<AspectRatio | null>>;
  newProjectItem: MediaItem | null;
  setNewProjectItem: Dispatch<SetStateAction<MediaItem | null>>;
} & Parameters<typeof Dialog>[0];
// #endregion

// #region MAIN
export function ProjectDialog({
  onOpenChange,
  supabase,
  user,
  project,
  setProject,
  setRatio,
  newProjectItem,
  setNewProjectItem,
  ...props
}: ProjectDialogProps) {
  // #region Const & Effects
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio | null>(null);
  //const queryClient = useQueryClient();
  const { toast } = useToast();
  // #endregion

  // #region Get Projects
  useEffect(() => {
    const getProjects = async () => {
      setIsLoading(true);
      if (user) {
        try {
          const { data, error } = await supabase
            .from("projects")
            .select(`id, title, description, dimensions`)
            .eq("user_id", user.id);

          if (error) {
            console.error("Error fetching data:", error.message);
            setIsLoading(false);
          } else {
            const projects: VideoProject[] = data.map((project) => ({
              id: String(project.id),
              title: String(project.title),
              description: String(project.description),
              aspectRatio: project.dimensions as AspectRatio,
            }));
            setProjects(projects);
            setIsLoading(false);
          }
        } catch (error) {
          console.error("Unexpected error:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    getProjects();
  }, [user]);
  // #endregion

  //#region New Create Project
  const handleCreateProject = async () => {
    if (!title.trim() || !user) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("projects")
        .insert([
          {
            user_id: user.id,
            title: title,
            description: description,
            status: "draft",
            dimensions: aspectRatio ?? "16:9",
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Error creating project:", error);
        toast({
          title: "Error!",
          description: "Could not create project. Try again.",
        });
        return;
      }

      if (newProjectItem) {
        try {
          const newTrackType =
            newProjectItem.type === "image" ? "video" : newProjectItem.type;
          let track;

          const { data: newTrack, error: errorTrack } = await supabase
            .from("projects_assets")
            .insert([
              {
                project_id: data.id,
                asset_id: newProjectItem.id,
                type: newTrackType,
                label: newProjectItem.type,
                locked: true,
              },
            ])
            .select()
            .single();

          if (errorTrack) {
            console.log("Error adding track to new project: ", errorTrack);
            throw errorTrack;
          }

          track = newTrack;
          const baseData = {
            track_id: track.id,
            timestamp: 0,
            duration: newProjectItem.metadata?.duration
              ? Math.ceil(newProjectItem.metadata.duration * 1000)
              : 5000,
            asset_id: newProjectItem.id,
          };
          let insertData;
          if (newProjectItem?.metadata && "input" in newProjectItem.metadata) {
            insertData = {
              ...baseData,
              type: newProjectItem.metadata.input?.image_url
                ? "image"
                : "prompt",
              prompt: newProjectItem.metadata.input.prommpt || "",
              url: newProjectItem.metadata.input.image_url?.url,
            };
          } else if (
            newProjectItem?.metadata &&
            "description" in newProjectItem.metadata
          ) {
            insertData = {
              ...baseData,
              type: newProjectItem.type,
              prompt: newProjectItem.metadata.description || "",
              url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${newProjectItem.file_path}`,
            };
          } else {
            toast({
              title: "Cannot drop asset",
              description: "Error inserting media",
            });
            return;
          }

          const { data: newKeyframe, error: noNewKeyframe } = await supabase
            .from("keyframes")
            .insert(insertData)
            .select()
            .single();

          if (noNewKeyframe) {
            console.log("Error inserting keyframes: ", noNewKeyframe);
            throw noNewKeyframe;
          }
        } catch (error) {
          console.error(
            "An error occurred while processing newProjectItem:",
            error,
          );
          toast({
            title: "Error!",
            description:
              "An error occurred while processing the asset. Please try again.",
          });
        } finally {
          setNewProjectItem(null);
        }
      }

      handleSelectProject(data);
      toast({
        title: "Project Created",
        description: `Project "${data.title}" created successfully!`,
      });
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      toast({
        title: "Error!",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  //#endregion

  // #region Suggest Project
  const suggestProject = useMutation({
    mutationFn: async () => {
      return createProjectSuggestion();
    },
    onSuccess: (suggestion) => {
      setTitle(suggestion.title);
      setDescription(suggestion.description);
    },
    onError: (error) => {
      console.warn("Failed to create suggestion", error);
      toast({
        title: "Failed to create suggestion",
        description:
          "There was an unexpected error while generating a suggestion. Try again.",
      });
    },
  });
  // #endregion

  // #region SelectProject
  const setProjectDialogOpen = useVideoProjectStore(
    (s) => s.setProjectDialogOpen,
  );

  const handleSelectProject = (project: VideoProject) => {
    setProject(project);
    setRatio(aspectRatio);
    setProjectDialogOpen(false);
    rememberLastProjectId(project.id);
  };
  // #endregion

  // #region OpenProject
  const handleOnOpenChange = (isOpen: boolean) => {
    setTitle("");
    setDescription("");
    setAspectRatio(null);
    onOpenChange?.(isOpen);
    setProjectDialogOpen(isOpen);
  };
  // #endregion

  // #region MainJSX
  return (
    <Dialog {...props} onOpenChange={handleOnOpenChange}>
      <DialogContent className="flex flex-col max-w-4xl h-fit max-h-[520px] min-h-[380px]">
        <DialogHeader>
          <div className="flex flex-row gap-2 mb-4">
            <span className="text-lg font-medium">
              <Logo />
            </span>
          </div>
          <DialogTitle className="sr-only">New Project</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new or open an existent project
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-row gap-8 h-full">
          {/* New Project Form */}
          <div className="flex flex-col flex-1 gap-8">
            <h2 className="text-lg font-semibold flex flex-row gap-2">
              <FileVideoIcon className="w-6 h-6 opacity-50 stroke-1" />
              Create New Project
            </h2>
            <div className="flex flex-col gap-4">
              <Input
                placeholder="Project Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Describe your project"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>
            <div className="flex flex-row gap-2">
              <Button
                className={cn(
                  "w-full text-left p-3 rounded",
                  "bg-card hover:bg-accent transition-colors",
                  "border border-border",
                  aspectRatio === "16:9"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground", // Resalta el botón seleccionado
                )}
                onClick={() => setAspectRatio("16:9")}
              >
                16:9
              </Button>
              <Button
                className={cn(
                  "w-full text-left p-3 rounded",
                  "bg-card hover:bg-accent transition-colors",
                  "border border-border",
                  aspectRatio === "1:1"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground", // Resalta el botón seleccionado
                )}
                onClick={() => setAspectRatio("1:1")}
              >
                1:1
              </Button>
              <Button
                className={cn(
                  "w-full text-left p-3 rounded",
                  "bg-card hover:bg-accent transition-colors",
                  "border border-border",
                  aspectRatio === "9:16"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground", // Resalta el botón seleccionado
                )}
                onClick={() => setAspectRatio("9:16")}
              >
                9:16
              </Button>
            </div>
            <div className="flex-1 flex flex-row items-end justify-center gap-2">
              {/* <WithTooltip tooltip="Out of ideas? Generate a new random project.">
                <Button
                  variant="secondary"
                  disabled={suggestProject.isPending}
                  onClick={() => suggestProject.mutate()}
                >
                  {suggestProject.isPending ? (
                    <LoadingIcon />
                  ) : (
                    <WandSparklesIcon className="opacity-50" />
                  )}
                  Generate
                </Button>
              </WithTooltip> */}
              <Button
                /* onClick={() => createProject.mutate( { title, description, aspectRatio: "16:9", }, { onSuccess: (projectId) => { handleSelectProject({ id: projectId } as VideoProject); }, }, ) } */
                onClick={handleCreateProject}
                disabled={!title.trim() || isLoading}
              >
                {isLoading ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-center">
            <Separator orientation="vertical" className="flex-1" />
            <span className="font-semibold">or</span>
            <Separator orientation="vertical" className="flex-1" />
          </div>

          {/* Existing Projects */}
          <div className="flex flex-col flex-1 gap-8">
            <h2 className="text-lg font-semibold flex flex-row gap-2">
              <FolderOpenIcon className="w-6 h-6 opacity-50 stroke-1" />
              Open Existing Project
            </h2>
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
              {isLoading ? (
                // Loading skeletons
                <>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="w-full h-[72px] rounded-lg" />
                  ))}
                </>
              ) : projects?.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No projects found
                </div>
              ) : (
                // Project list
                projects?.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project)}
                    className={cn(
                      "w-full text-left p-3 rounded",
                      "bg-card hover:bg-accent transition-colors",
                      "border border-border",
                    )}
                  >
                    <h3 className="font-medium text-sm">{project.title}</h3>
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <p className="text-muted-foreground text-sm mt-4 w-full text-center">
            This is an{" "}
            <a
              className="underline underline-offset-2 decoration-foreground/50 text-foreground"
              href="https://github.com/fal-ai-community/video-starter-kit"
            >
              open-source
            </a>{" "}
            project developed by{" "}
            <a
              className="underline underline-offset-2 decoration-foreground/50 text-foreground"
              href="https://fal.ai"
            >
              {" "}
              fal.ai
            </a>{" "}
            and its partners.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  //#endregion
}
//#endregion
