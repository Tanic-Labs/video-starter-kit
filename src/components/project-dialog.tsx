"use client";

// #region IMPORTS
import { useProjectCreator } from "@/data/mutations";
import { queryKeys, useProjects } from "@/data/queries";
import type { VideoProject } from "@/data/schema";
import { useVideoProjectStore } from "@/data/store";
import { useToast } from "@/hooks/use-toast";
import { createProjectSuggestion } from "@/lib/project";
import { cn, rememberLastProjectId } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileVideoIcon, FolderOpenIcon, WandSparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
import { LoadingIcon } from "./ui/icons";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";
import { Textarea } from "./ui/textarea";
import { WithTooltip } from "./ui/tooltip";
import { seedDatabase } from "@/data/seed";
import { SupabaseClient } from "@supabase/supabase-js";
// #endregion

// #region TYPES
type ProjectDialogProps = {
  supabase: SupabaseClient;
} & Parameters<typeof Dialog>[0];
// #endregion

// #region MAIN
export function ProjectDialog({
  onOpenChange,
  supabase,
  ...props
}: ProjectDialogProps) {
  // #region Const & Effects
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch existing projects
  const { data: projects = [], isLoading } = useProjects();

  // Seed data with template project if empty
  useEffect(() => {
    if (projects.length === 0 && !isLoading) {
      seedDatabase().then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      });
    }
  }, [projects, isLoading]);
  // #endregion

  // #region Old Create Project
  // Create project mutation
  /* const setProjectId = useVideoProjectStore((s) => s.setProjectId);
  const createProject = useProjectCreator(); */
  // #endregion

  //#region New Create Project
  const handleCreateProject = async () => {
    if (!title.trim) return;

    const { data, error } = await supabase
      .from("projects")
      .insert([
        {
          user_id: "58e01467-2bbf-418f-9210-de8b76334dc4",
          title: title,
          description: description,
          status: "draft",
          dimensions: "16:9",
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

    handleSelectProject(data);
    toast({
      title: "Project Created",
      description: `Project "${data.title}" created successfully!`,
    });
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
    setProjectId(project.id);
    setProjectDialogOpen(false);
    rememberLastProjectId(project.id);
  };
  // #endregion

  // #region OpenProject
  const handleOnOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTitle("");
      setDescription("");
    }
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
            <div className="flex-1 flex flex-row items-end justify-center gap-2">
              <WithTooltip tooltip="Out of ideas? Generate a new random project.">
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
              </WithTooltip>
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
