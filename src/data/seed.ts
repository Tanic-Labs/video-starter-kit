import { db } from "@/data/db";
import { VideoProject, MediaItem, VideoTrack, VideoKeyFrame } from "./schema";

type ProjectSeed = {
  project: VideoProject;
  media: MediaItem[];
  tracks: VideoTrack[];
  keyframes: VideoKeyFrame[];
};

const TEMPLATE_PROJECT_SEED: ProjectSeed = {
  project: {
    title: "The morning brew",
    description:
      "A starter project that shows off the features of the video editor.",
    aspectRatio: "16:9",
    id: "433685b7-3494-4a56-9657-c1522686139d",
  },
  media: [
    {
      id: "c41cbde0-680b-4dd3-a94e-04d66726a1ed",
      user_id: "",
      type: "audio",
      source_type: "generated",
      file_path:
        "https://v2.fal.media/files/c8c6eb5859584e9382ac7c6202a98ac2_tmpla47ie4n.wav",
      created_at: 1737486876353,
      metadata: {
        name: "lofi beats, chill morning song in a bossa nova style",
        status: "completed",
        type: "audio",
        input: {
          prompt: "lofi beats, chill morning song in a bossa nova style",
          seconds_total: 17,
        },
        output: {
          audio_file: {
            url: "https://v2.fal.media/files/c8c6eb5859584e9382ac7c6202a98ac2_tmpla47ie4n.wav",
            content_type: "application/octet-stream",
            file_name: "tmpla47ie4n.wav",
            file_size: 2998878,
          },
        },
        endpointId: "fal-ai/stable-audio",
        requestId: "7d2d12f8-41d8-4e20-87a1-d4fdf8a7a28b",
        duration: 17,
      },
    },
    {
      id: "1b8473a5-7a50-4354-be7a-3d3d5c1edc58",
      user_id: "",
      type: "voiceover",
      source_type: "generated",
      file_path:
        "https://v3.fal.media/files/rabbit/cZzZVGe4ugQEAMBruZvgh_01a71259-c5f1-4fc2-940e-98f1ddc0d34a.mp3",
      created_at: 1737486790214,
      metadata: {
        name: "There's nothing like a fresh cup of coffee in a sunny morning",
        status: "completed",
        type: "voiceover",
        input: {
          prompt:
            "There's nothing like a fresh cup of coffee in a sunny morning",
          seconds_total: 30,
          voice: "Cecil (English (GB)/British)",
          input:
            "There's nothing like a fresh cup of coffee in a sunny morning",
        },
        output: {
          audio: {
            url: "https://v3.fal.media/files/rabbit/cZzZVGe4ugQEAMBruZvgh_01a71259-c5f1-4fc2-940e-98f1ddc0d34a.mp3",
            content_type: "audio/mpeg",
            file_name: "01a71259-c5f1-4fc2-940e-98f1ddc0d34a.mp3",
            file_size: 71469,
            duration: 2.946,
          },
        },
        endpointId: "fal-ai/playht/tts/v3",
        requestId: "991f473d-7e15-48d1-bc01-fe033d7f7773",
        duration: 2.976,
      },
    },
    {
      id: "89e9a2f8-a6a7-445d-bf45-f489395db200",
      user_id: "",
      type: "video",
      source_type: "generated",
      file_path:
        "https://fal.media/files/koala/3xD7JOTCNYwUwiOaV047W_output.mp4",
      created_at: 1737486533032,
      metadata: {
        name: "Coffee beans grinding on a morning setting",
        status: "completed",
        type: "video",
        input: {
          prompt: "Coffee beans grinding on a morning setting",
          image_url: "https://fal.media/files/rabbit/lqoM2SZ6yArJG4dc5i6Eu.png",
          aspect_ratio: "16:9",
        },
        output: {
          video: {
            url: "https://fal.media/files/koala/3xD7JOTCNYwUwiOaV047W_output.mp4",
            content_type: "video/mp4",
            file_name: "output.mp4",
            file_size: 372192,
          },
        },
        endpointId: "fal-ai/minimax/video-01-live/image-to-video",
        requestId: "994b9ca4-a710-4c50-ab1e-ebd5fb2b3648",
        duration: 5.64,
        start_frame_url:
          "https://v3.fal.media/files/lion/lNDR8wzGJmAgPtSdroZso_start_frame.png",
        end_frame_url:
          "https://v3.fal.media/files/monkey/IrmTo3WlXwU_xt2e7LWZR_end_frame.png",
      },
    },
    {
      id: "4fc9a50b-6a3c-47ef-93e8-48341b4f050e",
      user_id: "",
      type: "video",
      source_type: "generated",
      file_path:
        "https://fal.media/files/kangaroo/tusxIei9BCsgat_K0H_Dr_output.mp4",
      created_at: 1737486526606,
      metadata: {
        name: "a steaming cup of coffee on a cozy morning scene",
        status: "completed",
        type: "video",
        input: {
          prompt:
            "a steaming cup of coffee on a cozy morning scene, with the warm sunlight peeking through the blinds, as the sound of gentle brewing fills the air.",
          image_url: "https://fal.media/files/koala/zyEDUZ9j-AsNCatPaFmYO.png",
          aspect_ratio: "16:9",
        },
        output: {
          video: {
            url: "https://fal.media/files/kangaroo/tusxIei9BCsgat_K0H_Dr_output.mp4",
            content_type: "video/mp4",
            file_name: "output.mp4",
            file_size: 389484,
          },
        },
        endpointId: "fal-ai/minimax/video-01-live/image-to-video",
        requestId: "830a26dc-e7ec-4509-b12d-15deeb619c37",
        duration: 5.64,
        start_frame_url:
          "https://v3.fal.media/files/tiger/vcYlw7KVM_GYJ27Rbwe5k_start_frame.png",
        end_frame_url:
          "https://v3.fal.media/files/koala/oslkG0Zf4xKBWk1oY95GD_end_frame.png",
      },
    },
    {
      //projectId: "433685b7-3494-4a56-9657-c1522686139d",
      id: "92f32f84-c11e-4e26-afd9-c73d4ac88c25",
      user_id: "",
      file_path: "",
      created_at: 1737486511674,
      type: "image",
      source_type: "generated",
      metadata: {
        name: "",
        status: "completed",
        type: "image",
        input: {
          prompt: "Coffee beans grinding on a morning setting",
          image_size: "landscape_16_9",
          seconds_total: 30,
        },
        output: {
          images: [
            {
              url: "https://fal.media/files/rabbit/lqoM2SZ6yArJG4dc5i6Eu.png",
              width: 1024,
              height: 576,
              content_type: "image/jpeg",
            },
          ],
          timings: {
            inference: 1.5897783394902945,
          },
          seed: 2349012095,
          has_nsfw_concepts: [false],
          prompt: "Coffee beans grinding on a morning setting",
        },
        endpointId: "fal-ai/flux/dev",
        requestId: "69ee44e4-b55f-475c-8691-fd88ed8af293",
      },
    },
    {
      //projectId: "433685b7-3494-4a56-9657-c1522686139d",
      id: "25a45955-5274-433b-8cdb-8387ecff5157",
      user_id: "",
      file_path: "",
      created_at: 1737486437745,
      type: "image",
      source_type: "generated",
      metadata: {
        name: "",
        status: "completed",
        type: "",
        input: {
          prompt:
            "a steaming cup of coffee on a cozy morning scene, with the warm sunlight peeking through the blinds, as the sound of gentle brewing fills the air.",
          image_size: "landscape_16_9",
          seconds_total: 30,
        },
        output: {
          images: [
            {
              url: "https://fal.media/files/koala/zyEDUZ9j-AsNCatPaFmYO.png",
              width: 1024,
              height: 576,
              content_type: "image/jpeg",
            },
          ],
          timings: {
            inference: 1.599838787689805,
          },
          seed: 3670790609,
          has_nsfw_concepts: [false],
          prompt:
            "a steaming cup of coffee on a cozy morning scene, with the warm sunlight peeking through the blinds, as the sound of gentle brewing fills the air.",
        },
        endpointId: "fal-ai/flux/dev",
        requestId: "e62ee21f-270f-4260-a1d0-139494a8e3f3",
      },
    },
    {
      id: "40cec777-9f45-465a-ace4-4fdc4000fa9e",
      user_id: "",
      type: "video",
      source_type: "generated",
      file_path:
        "https://fal.media/files/tiger/3MaLDMcELHRLdI_wpaeIB_output.mp4",
      created_at: 1737486370974,
      metadata: {
        name: "Image of a steaming cup of coffee in a quiet morning setting",
        status: "completed",
        type: "video",
        input: {
          prompt:
            "Image of a steaming cup of coffee in a quiet morning setting, showcasing the morning brew process, using the Coffee machine as a central feature",
          image_url:
            "https://fal.media/files/kangaroo/w0qQbeIhqmZfEttswt-HD.png",
          aspect_ratio: "16:9",
        },
        output: {
          video: {
            url: "https://fal.media/files/tiger/3MaLDMcELHRLdI_wpaeIB_output.mp4",
            content_type: "video/mp4",
            file_name: "output.mp4",
            file_size: 398174,
          },
        },
        endpointId: "fal-ai/minimax/video-01-live/image-to-video",
        requestId: "278d33fc-2eb9-4aaa-9f61-2851c5a82fbb",
        duration: 5.64,
        start_frame_url:
          "https://v3.fal.media/files/monkey/WuO2_lfG3R6uggUWBA6Qv_start_frame.png",
        end_frame_url:
          "https://v3.fal.media/files/elephant/Ti8XbHVdc78bgONN4waSL_end_frame.png",
      },
    },
    {
      //projectId: "433685b7-3494-4a56-9657-c1522686139d",
      created_at: 1737486358044,
      id: "8e1fc138-a967-4d05-8cbf-aeb6e8e643e4",
      user_id: "",
      file_path: "",
      type: "image",
      source_type: "generated",
      metadata: {
        name: "",
        type: "",
        endpointId: "fal-ai/flux/dev",
        requestId: "a1adf628-cc0a-4700-ba06-0aa8a96cb5e8",
        status: "completed",
        input: {
          prompt:
            "Image of a steaming cup of coffee in a quiet morning setting, showcasing the morning brew process, using the Coffee machine as a central feature",
          image_size: "landscape_16_9",
          seconds_total: 30,
        },
        output: {
          images: [
            {
              url: "https://fal.media/files/kangaroo/w0qQbeIhqmZfEttswt-HD.png",
              width: 1024,
              height: 576,
              content_type: "image/jpeg",
            },
          ],
          timings: {
            inference: 1.603529468877241,
          },
          seed: 20684661,
          has_nsfw_concepts: [false],
          prompt:
            "Image of a steaming cup of coffee in a quiet morning setting, showcasing the morning brew process, using the Coffee machine as a central feature",
        },
      },
    },
  ],
  tracks: [
    {
      projectId: "433685b7-3494-4a56-9657-c1522686139d",
      type: "voiceover",
      label: "voiceover",
      locked: true,
      id: "04bd485f-0856-485c-96cf-5b698c690c39",
    },
    {
      projectId: "433685b7-3494-4a56-9657-c1522686139d",
      type: "video",
      label: "video",
      locked: true,
      id: "700049df-22c3-4419-b886-c9b200851ac8",
    },
    {
      projectId: "433685b7-3494-4a56-9657-c1522686139d",
      type: "audio",
      label: "audio",
      locked: true,
      id: "dc875d02-e09c-4d57-9d71-1c152e1a5798",
    },
  ],
  keyframes: [
    {
      trackId: "04bd485f-0856-485c-96cf-5b698c690c39",
      data: {
        mediaId: "1b8473a5-7a50-4354-be7a-3d3d5c1edc58",
        type: "prompt",
        prompt: "There's nothing like a fresh cup of coffee in a sunny morning",
      },
      timestamp: 9207.920792079207,
      duration: 2976,
      id: "5682fa05-4f24-40e1-9de9-c4db1ed8aeff",
    },
    {
      trackId: "700049df-22c3-4419-b886-c9b200851ac8",
      data: {
        mediaId: "89e9a2f8-a6a7-445d-bf45-f489395db200",
        type: "image",
        prompt: "Coffee beans grinding on a morning setting",
      },
      timestamp: 1,
      duration: 5640,
      id: "e0ad9534-267d-47fb-b512-a723e7ac04c6",
    } as any,
    {
      trackId: "700049df-22c3-4419-b886-c9b200851ac8",
      data: {
        mediaId: "40cec777-9f45-465a-ace4-4fdc4000fa9e",
        type: "image",
        prompt:
          "Image of a steaming cup of coffee in a quiet morning setting, showcasing the morning brew process, using the Coffee machine as a central feature",
      },
      timestamp: 5642,
      duration: 5640,
      id: "2596b76f-a198-49a9-bcd8-6f8263fd45b1",
    },
    {
      trackId: "700049df-22c3-4419-b886-c9b200851ac8",
      data: {
        mediaId: "4fc9a50b-6a3c-47ef-93e8-48341b4f050e",
        type: "image",
        prompt:
          "a steaming cup of coffee on a cozy morning scene, with the warm sunlight peeking through the blinds, as the sound of gentle brewing fills the air.",
      },
      timestamp: 11283,
      duration: 5640,
      id: "7e846b84-934b-49a2-a9ac-6b21ca7edb98",
    },
    {
      trackId: "dc875d02-e09c-4d57-9d71-1c152e1a5798",
      data: {
        mediaId: "c41cbde0-680b-4dd3-a94e-04d66726a1ed",
        type: "prompt",
        prompt: "lofi beats, chill morning song in a bossa nova style",
      },
      timestamp: 1,
      duration: 17000,
      id: "2c2fc7a7-76d8-48a6-b53d-b89cf09e249b",
    },
  ],
};

export const seedDatabase = async () => {
  await db.projects.create(TEMPLATE_PROJECT_SEED.project);
  await Promise.all(TEMPLATE_PROJECT_SEED.media.map(db.media.create));
  await Promise.all(TEMPLATE_PROJECT_SEED.tracks.map(db.tracks.create));
  await Promise.all(TEMPLATE_PROJECT_SEED.keyframes.map(db.keyFrames.create));
};
