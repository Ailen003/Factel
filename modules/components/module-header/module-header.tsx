import NavigationComponent from "@/components/navigation-component/navigation-component";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ReactNode } from "react";
import { RefreshButton } from "./refresh-button";

interface Props {
    title: string;
    icon?: ReactNode
    description?: string;
    generatePdfButton?: ReactNode;
    createButton?: {
        label: string;
        href: string;
    };
    actionTrigger?: ReactNode;
    showRefresh?: boolean;
}

export function ModuleHeader({
    title,
    icon,
    description,
    createButton,
    generatePdfButton,
    actionTrigger,
    showRefresh,
}: Props) {
    return (
        <div className="w-full">

            <div className="flex flex-col w-full gap-5 2md:flex-row 2md:items-center justify-between 2md:pb-4">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        {icon && icon}
                        <h2 className="text-lg w-full font-semibold text-foreground sm:text-xl">{title}</h2>
                    </div>
                    {description && <p className="text-muted-foreground text-xs sm:text-sm">
                        {description}
                    </p>}
                </div>
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-4">
                    {showRefresh && <RefreshButton />}
                    {generatePdfButton && generatePdfButton}
                    {actionTrigger && actionTrigger}
                    {createButton &&
                        <NavigationComponent href={createButton.href}>
                            <Button variant={'default'} >
                                <Plus className="h-4 w-4" />
                                {createButton.label}
                            </Button>
                        </NavigationComponent>
                    }
                </div>
            </div>
        </div>
    );
}
