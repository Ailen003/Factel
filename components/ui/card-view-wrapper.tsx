import React, { ReactNode } from "react";

export interface HeaderConfig {
  /**
   * Title to display above the cards. Required when headerConfig is provided.
   */
  title: string;
  /**
   * Optional icon to display alongside the title.
   */
  icon?: ReactNode;
}

interface CardViewWrapperProps {
  children: ReactNode;
  headerConfig?: HeaderConfig;
  className?: string;
}

export function CardViewWrapper({
  children,
  headerConfig,
  className = "",
}: CardViewWrapperProps) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {headerConfig && (
        <div className="flex items-center gap-2">
          {headerConfig.icon && (
            <div className="text-primary">{headerConfig.icon}</div>
          )}
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{headerConfig.title}</h2>
        </div>
      )}
      {children}
    </div>
  );
}
