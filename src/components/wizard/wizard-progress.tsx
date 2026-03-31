import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { label: "Project", description: "Discover tables" },
  { label: "Import", description: "Choose source" },
  { label: "Datasets", description: "Review fields" },
  { label: "Metrics", description: "Review metrics" },
  { label: "Joins", description: "Relationships" },
  { label: "Glossary", description: "Terms" },
  { label: "Rules", description: "Constraints" },
  { label: "Create", description: "Review & create" },
];

export function WizardProgress({ currentStep }: { currentStep: number }) {
  return (
    <nav className="flex items-center gap-0.5 mb-8 overflow-x-auto pb-1">
      {STEPS.map((step, i) => (
        <div key={step.label} className="flex items-center shrink-0">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium border-2 transition-all",
                i < currentStep
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === currentStep
                    ? "border-primary text-primary bg-background"
                    : "border-border text-muted-foreground bg-background"
              )}
            >
              {i < currentStep ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <div className="hidden lg:block">
              <div className={cn("text-[11px] font-medium leading-tight", i <= currentStep ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </div>
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("w-5 h-px mx-1", i < currentStep ? "bg-primary" : "bg-border")} />
          )}
        </div>
      ))}
    </nav>
  );
}
