// import { fal } from "@/lib/fal"; // <-- comment of fal library
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "./db";
import { queryKeys, VideoCompositionData } from "./queries";
import type { VideoProject } from "./schema";
import { supabase } from "@/lib/supabase"; // <-- import o supabase

// Endpoints de Digital Ocean
const DIGITAL_OCEAN_ENDPOINT = //<-- Generate Assests
  "https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/namespaces/fn-0b1258df-ad0b-4cd5-8e7e-c7f326495f3c/actions/twitter/video-generation";
const DIGITAL_OCEAN_EXPORT_ENDPOINT = //<-- Export project
  "https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-0b1258df-ad0b-4cd5-8e7e-c7f326495f3c/twitter/video-export";
const AUTH_TOKEN =
  "NmYxYmNhMWItNDEzMy00ZTQxLWJkMTEtMzFkOTU5MGE3OTE1OmFhWFRBVUNXMTdpNUlsZEd2ejNUakJMdzBDZDVhV0p6NzRzNVcwamdkMklaVDFJVHUzQWNIZE1GWmtnc3V1MVE=";
const AUTH_TOKEN_EXPORT =
  "NmYxYmNhMWItNDEzMy00ZTQxLWJkMTEtMzFkOTU5MGE3OTE1OmFhWFRBVUNXMTdpNUlsZEd2ejNUakJMdzBDZDVhV0p6NzRzNVcwamdkMklaVDFJVHUzQWNIZE1GWmtnc3V1MVE=";

type JobCreatorParams = {
  userId: string;
  projectId: string;
  endpointId: string;
  mediaType: "video" | "image" | "voiceover" | "audio";
  input: Record<string, any>;
  urlImage: any;
  urlAudio: any;
  urlVideo: any;
};

export type shareResult = {
  video_url: string;
  thumbnail_url: string;
};

export const useProjectUpdater = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (project: Partial<VideoProject>) =>
      db.projects.update(projectId, project),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
};

export const useProjectCreator = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (project: Omit<VideoProject, "id">) =>
      db.projects.create(project),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
};

export const useJobCreator = ({
  userId,
  projectId,
  endpointId,
  mediaType,
  input,
  urlImage,
  urlAudio,
  urlVideo,
}: JobCreatorParams) => {
  return useMutation({
    mutationFn: async () => {
      //CREACION DE ROW EN ASSETS
      const { data: assetData } = await supabase
        .from("assets")
        .insert([
          {
            user_id: userId,
            type: mediaType === "voiceover" ? "voice" : mediaType,
            source_type: "generated",
            metadata: { status: "pending" },
          },
        ])
        .select("*")
        .single();

      if (!assetData) {
        throw new Error("No generation data returned");
      }

      //CREACION DE ROW EN GENERATIONS
      const { data: generationData } = await supabase
        .from("generations")
        .insert([{ user_id: userId, asset_id: assetData?.id }])
        .select("*")
        .single();

      if (!generationData) {
        throw new Error("No generation data returned");
      }

      //USAR EL ID Y SE LO MANDO PARA GENERATION Y ID DE ASSETS
      const payload = {
        userId: userId,
        assetDataId: assetData?.id,
        prompt: input.prompt,
        mediaType: mediaType === "voiceover" ? "voice" : mediaType,
        endpointModel: endpointId,
        dataInsertId: generationData?.id,
        type: mediaType === "voiceover" ? "voice" : mediaType,
        imageUrl: urlImage,
        videoUrl: urlVideo,
        audioUrl: urlAudio,
      };

      //ENDPOINT DE DIGITAL OCEAN
      const response = await fetch(
        `${DIGITAL_OCEAN_ENDPOINT}?blocking=true&result=true`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${AUTH_TOKEN}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const responseData = await response.json();

      // Si hay un error, actualizamos el estado y lanzamos el error
      if (!response.ok || responseData.status === "ERROR") {
        // Actualizar estados a FAILED
        if (generationData?.id) {
          await supabase
            .from("generations")
            .update({ status: "FAILED" })
            .eq("id", generationData.id);
        }

        if (assetData?.id) {
          await supabase
            .from("assets")
            .update({
              metadata: { status: "failed" },
            })
            .eq("id", assetData.id);
        }

        // Lanzar el error con los detalles de la respuesta
        throw new Error(JSON.stringify(responseData?.message));
      }

      return responseData;
    },
  });
};

/**
 * Hook to export video via serverless function in Digital Ocean
 */
export const useVideoExport = ({
  project,
  user,
  composition,
}: {
  project: VideoProject | null;
  user: any | null;
  composition: VideoCompositionData;
}) => {
  return useMutation({
    mutationFn: async () => {
      try {
        if (!user || !project) {
          throw new Error("User or project invalid");
        }

        // Prepare payload for digital ocean
        const payload = {
          userId: user.id,
          projectId: project.id,
          composition: composition,
          project: {
            id: project.id,
            title: project.title,
            description: project.description,
          },
        };

        console.log("iniciando llamado a DO con este payload: ", payload);

        // CORREGIDO: Añadir los parámetros blocking=true&result=true a la URL
        const response = await fetch(
          `${DIGITAL_OCEAN_EXPORT_ENDPOINT}?blocking=true&result=true`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${AUTH_TOKEN_EXPORT}`,
            },
            body: JSON.stringify(payload),
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();

        // Verify successful response
        if (responseData.status === "ERROR") {
          const errorMessage = responseData.message || "Error exporting video";
          throw new Error(errorMessage);
        }

        console.log(responseData);
        // Return final data
        return responseData.data as shareResult;
      } catch (error) {
        // Log the error for debugging
        console.error("Video export error:", error);

        // Rethrow the error to be handled by the mutation's onError callback
        throw error;
      } finally {
        console.log("Video export process completed");
      }
    },
  });
};
