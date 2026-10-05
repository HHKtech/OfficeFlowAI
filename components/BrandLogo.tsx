import Image from "next/image";
import logo from "@/app/logo.png";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = "size-12", priority = false }: BrandLogoProps) {
  return (
    <Image
      src={logo}
      alt="OfficeFlow AI"
      className={`shrink-0 object-contain ${className}`}
      priority={priority}
    />
  );
}
