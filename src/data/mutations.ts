// import { fal } from "@/lib/fal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "./db";
import { queryKeys } from "./queries";
import type { VideoProject } from "./schema";
import { supabase } from "@/lib/supabase";

const DIGITAL_OCEAN_ENDPOINT =
  "https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/namespaces/fn-0b1258df-ad0b-4cd5-8e7e-c7f326495f3c/actions/twitter/video-generation";
const AUTH_TOKEN =
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
      //CREAR EL ID DEL
      const { data: generationData } = await supabase
        .from("generations")
        .insert([{ user_id: userId }])
        .select("*")
        .single();

      if (!generationData) {
        throw new Error("No generation data returned");
      }

      //USAR EL ID Y SE LO MANDO PARA GENERATION
      const payload = {
        userId: userId,
        mediaType: mediaType === "voiceover" ? "voice" : mediaType,
        endpointModel: endpointId,
        dataInsertId: generationData?.id,
        type: mediaType === "voiceover" ? "voice" : mediaType,
        prompt: input.prompt || "Default prompt",
        imageUrl: urlImage,
        videoUrl: urlVideo,
        audioUrl: urlAudio,
      };

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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    },
  });
};
