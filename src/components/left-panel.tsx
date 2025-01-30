"use client";

// #region IMPORTS
import { SupabaseClient } from "@supabase/supabase-js";
import { useProjectUpdater } from "@/data/mutations";
import { queryKeys, useProject, useProjectMediaItems } from "@/data/queries";
import { type MediaItem, PROJECT_PLACEHOLDER } from "@/data/schema";
import {
  type MediaType,
  useProjectId,
  useVideoProjectStore,
} from "@/data/store";
import {
  ChevronDown,
  FilmIcon,
  FolderOpenIcon,
  GalleryVerticalIcon,
  ImageIcon,
  ImagePlusIcon,
  ListPlusIcon,
  MicIcon,
  MusicIcon,
  LoaderCircleIcon,
  CloudUploadIcon,
  SparklesIcon,
} from "lucide-react";
import { MediaItemPanel } from "./media-panel";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
// #endregion

// #region TYPES
type LeftPanelProps = {
  supabase: SupabaseClient;
  mediaItems: MediaItem[];
  isLoading: boolean;
  fetchData: () => Promise<void>;
};
// #endregion

export default function LeftPanel({
  supabase,
  mediaItems,
  isLoading,
  fetchData,
}: LeftPanelProps) {
  // #region CONSTANTS
  const projectId = useProjectId();
  const { data: project = PROJECT_PLACEHOLDER } = useProject(projectId);
  const projectUpdate = useProjectUpdater(projectId);
  const [mediaType, setMediaType] = useState("all");
  const [isUploading, setIsUploading] = useState(false);

  const setProjectDialogOpen = useVideoProjectStore(
    (s) => s.setProjectDialogOpen,
  );
  const openGenerateDialog = useVideoProjectStore((s) => s.openGenerateDialog);
  // #endregion

  // #region UPLOAD FILE
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setIsUploading(true);

    try {
      const user = { id: "58e01467-2bbf-418f-9210-de8b76334dc4" };
      const file = files[0]; // Suponemos que solo subimos un archivo por vez (puedes ajustar esto)
      const fileExt = file.name.split(".").pop();
      const assetId = crypto.randomUUID();
      // Insertar el archivo en la base de datos de 'assets'
      const mediaType = file.type.split("/")[0]; // Ajustar según sea necesario

      const filePath = `${user.id}/${mediaType}s/${assetId}.${fileExt}`;

      // Subir el archivo a Supabase Storage
      const { data, error } = await supabase.storage
        .from("assets") // Asegúrate de reemplazarlo con tu bucket de Supabase Storage
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.warn(`Error al subir archivo: ${error.message}`);
        toast({
          title: "Failed to upload file",
          description: "Please try again",
        });
        return;
      }

      const { data: assetData, error: assetError } = await supabase
        .from("assets") // Asegúrate de que el nombre de tu tabla sea 'assets'
        .insert([
          {
            id: assetId,
            user_id: user.id,
            type: mediaType,
            source_type: "uploaded",
            file_path: filePath, // La URL del archivo en Supabase Storage
            metadata: {
              name: "",
              size: file.size,
              type: file.type,
              description: "",
              orignalName: file.name,
            },
          },
        ]);

      if (assetError) {
        console.error(
          "Error al insertar en la tabla assets:",
          assetError.message,
        );
      } else {
        // Actualizamos los elementos de media
        fetchData();
        setIsUploading(false);
      }
    } catch (err) {
      console.warn(`ERROR! ${err}`);
      toast({
        title: "Failed to upload file",
        description: "Please try again",
      });
      setIsUploading(false);
    }
  };
  //#endregion

  //#region JSX
  return (
    <div className="flex flex-col border-r border-border w-96">
      <div className="p-4 flex flex-col gap-4 border-b border-border">
        <div className="flex flex-row items-start">
          <h2 className="text-sm text-muted-foreground font-semibold flex-1">
            Project Settings
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setProjectDialogOpen(true)}
          >
            <FolderOpenIcon className="w-4 h-4 opacity-50" />
            Open...
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <Input
            id="projectName"
            name="name"
            placeholder="untitled"
            value={project.title}
            onChange={(e) => projectUpdate.mutate({ title: e.target.value })}
            onBlur={(e) =>
              projectUpdate.mutate({ title: e.target.value.trim() })
            }
          />

          <Textarea
            id="projectDescription"
            name="description"
            placeholder="Describe your video"
            className="resize-none"
            value={project.description}
            rows={6}
            onChange={(e) =>
              projectUpdate.mutate({ description: e.target.value })
            }
            onBlur={(e) =>
              projectUpdate.mutate({ description: e.target.value.trim() })
            }
          />
        </div>
      </div>
      <div className="flex-1 py-4 flex flex-col gap-4 border-b border-border h-full overflow-hidden relative">
        <div className="flex flex-row items-center gap-2 px-4">
          <h2 className="text-sm text-muted-foreground font-semibold flex-1">
            Media Gallery
          </h2>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2">
                  <ListPlusIcon className="w-4 h-4 opacity-50" />
                  <span className="capitalize">{mediaType}</span>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="start">
                <DropdownMenuItem
                  className="text-sm"
                  onClick={() => setMediaType("all")}
                >
                  <GalleryVerticalIcon className="w-4 h-4 opacity-50" />
                  All
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm"
                  onClick={() => setMediaType("image")}
                >
                  <ImageIcon className="w-4 h-4 opacity-50" />
                  Image
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm"
                  onClick={() => setMediaType("audio")}
                >
                  <MusicIcon className="w-4 h-4 opacity-50" />
                  audio
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm"
                  onClick={() => setMediaType("voiceover")}
                >
                  <MicIcon className="w-4 h-4 opacity-50" />
                  Voiceover
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm"
                  onClick={() => setMediaType("video")}
                >
                  <FilmIcon className="w-4 h-4 opacity-50" />
                  Video
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="secondary"
              size="sm"
              disabled={isUploading}
              className="cursor-pointer disabled:cursor-default disabled:opacity-50"
              asChild
            >
              <label htmlFor="fileUploadButton">
                <Input
                  id="fileUploadButton"
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  multiple={false}
                  disabled={isUploading}
                  accept="image/*,audio/*,video/*"
                />
                {isUploading ? (
                  <LoaderCircleIcon className="w-4 h-4 opacity-50 animate-spin" />
                ) : (
                  <CloudUploadIcon className="w-4 h-4 opacity-50" />
                )}
              </label>
            </Button>
          </div>
          {mediaItems.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openGenerateDialog()}
            >
              <SparklesIcon className="w-4 h-4 opacity-50" />
              Generate...
            </Button>
          )}
        </div>
        {!isLoading && mediaItems.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-4 px-4">
            <p className="text-sm text-center">
              Create your image, audio and voiceover collection to compose your
              videos
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openGenerateDialog()}
            >
              <ImagePlusIcon className="w-4 h-4 opacity-50" />
              Generate...
            </Button>
          </div>
        )}

        {mediaItems.length > 0 && (
          <MediaItemPanel
            supabase={supabase}
            data={mediaItems}
            mediaType={mediaType}
            className="overflow-y-auto"
          />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background to-transparent via-background via-60% h-8 pointer-events-none" />
      </div>
    </div>
  );
  //#endregion
}
