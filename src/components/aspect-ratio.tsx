// AspectRatioSelector.tsx
import { cn } from "@/lib/utils";
import type { Dispatch, MouseEventHandler, SetStateAction } from "react";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { ChevronUp } from "lucide-react";
import { SupabaseClient } from "@supabase/supabase-js";
import { VideoProject } from "@/data/schema";
import { toast } from "@/hooks/use-toast";

const aspectRatioOptions = {
  "16:9": 16 / 9,
  // "4:3": 4 / 3,
  "1:1": 1,
  // "3:4": 3 / 4,
  "9:16": 9 / 16,
} as const;

export type AspectRatioOption = keyof typeof aspectRatioOptions;

interface AspectRatioSelectorProps {
  className?: string;
  onValueChange?:  Dispatch<SetStateAction<AspectRatioOption | null>>;
  value: AspectRatioOption | null;
  onCloseRatio?: Dispatch<SetStateAction<boolean>>;
  supabase: SupabaseClient;
  project: VideoProject;
}

export function AspectRatioSelector({
  className,
  onValueChange,
  value,
  onCloseRatio,
  supabase,
  project,
}: AspectRatioSelectorProps) {
  const handleOnClick = async (ratio: AspectRatioOption) => {
    try {
      const { data: newRatio, error: ratioError } = await supabase
        .from("projects")
        .update({
          dimensions: ratio
        }) 
        .eq("id", project.id)
        .select()
  
      if (ratioError) {
        console.log("Error updating ratio:", ratioError)
        throw ratioError;
      }
    } catch (error) {
      console.error("An error occurred: ", error);
    }
  };
  
  const onClickHandler = (ratio: AspectRatioOption) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (value === ratio) {
      onValueChange?.(null);
      return;
    }
    onValueChange?.(ratio);
    handleOnClick(ratio); // Llamada a la función asíncrona
  };

  const ratioValue = value ? aspectRatioOptions[value] : 0;

  return (
    <div
      className={cn(
        "mx-auto w-full flex-col items-center justify-center gap-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <ToggleGroup type="single" size="xs" value={value ?? ""}>
          {Object.keys(aspectRatioOptions).map((option) => (
            <ToggleGroupItem
              key={option}
              className="tabular-nums"
              onClick={onClickHandler(option as AspectRatioOption)}
              value={option}
            >
              {option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {onCloseRatio && (
          <button
            className="text-muted-foreground pb-2"
            onClick={() => onCloseRatio(false)}
          >
            <ChevronUp/>
          </button>
        )}
      </div>
      <div className="flex aspect-square w-full items-center justify-center">
        <div className="relative flex aspect-square h-full w-full items-center justify-center">
          <div className="text-sm tabular-nums">{value ?? "default"}</div>
          {!!value && (
            <div
              className={cn(
                "absolute border border-primary",
                "z-40 transition-all",
                {
                  "w-2/5": ratioValue <= 1,
                  "h-2/5": ratioValue > 1,
                },
              )}
              style={{
                aspectRatio: value.replace(":", "/"),
              }}
            />
          )}
          {Object.entries(aspectRatioOptions).map(([option, ratio]) => (
            <div
              key={option}
              className={cn(
                "absolute border border-dashed border-muted-foreground/70 transition-colors",
                {
                  "w-2/5": ratio <= 1,
                  "h-2/5": ratio > 1,
                },
              )}
              style={{
                aspectRatio: option.replace(":", "/"),
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
