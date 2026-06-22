/**
 * PageLayout - Simple animated wrapper for page content. Fades in and slides
 * up slightly on mount using framer-motion.
 */
import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
}

export const PageLayout = ({ children, className }: PageLayoutProps) => (
  <motion.div
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.14, ease: "easeOut" }}
    className={cn("enterprise-page min-h-full bg-[#F7F8FA] text-slate-950", className)}
  >
    {children}
  </motion.div>
);
