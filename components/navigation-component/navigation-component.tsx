
import Link from "next/link";
import  { ReactNode } from "react";

interface Props {
  children: ReactNode;
  href: string;
  inAnotherTab?: boolean;
  className?: string;
  scroll?: boolean;
  onClick?: () => void;
}

export default function NavigationComponent({
  children,
  href,
  inAnotherTab = false,
  className,
  scroll = true,
  onClick,
}: Props) {
  return (
    <Link
      href={href}
      scroll={scroll}
      onClick={onClick}
      {...(inAnotherTab && {
        target: "_blank",
        rel: "noopener noreferrer",
      })}
      className={className}
    >
      {children}
    </Link>
  );
}
