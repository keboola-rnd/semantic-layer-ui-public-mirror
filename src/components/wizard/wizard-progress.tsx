import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { label: "Project", description: "Discover tables" },
  { label: "Datasets", description: "Review fields" },
  { label: "Metrics", description: "Review metrics" },
  { label: "Enrich", description: "Upload files" },
  { label: "Create", description: "Review & create" },
];

export function WizardProgress({ currentStep }: { currentStep: number }) {
  return (
    <nav className="flex items-center gap-1 mb-8">
      {STEPS.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all",
                i < currentStep
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === currentStep
                    ? "border-primary text-primary bg-background"
                    : "border-border text-muted-foreground bg-background"
              )}
            >
              {i < currentStep ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <div className="hidden sm:block">
              <div className={cn("text-xs font-medium", i <= currentStep ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </div>
              <div className="text-[10px] text-muted-foreground">{step.description}</div>
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("w-8 h-px mx-2", i < currentStep ? "bg-primary" : "bg-border")} />
          )}
        </div>
      ))}
    </nav>
  );
}
