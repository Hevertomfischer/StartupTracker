import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type AvatarGroupProps = {
  members: {
    name: string;
    photoUrl?: string;
  }[];
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function AvatarGroup({
  members,
  max = 3,
  size = "md",
  className
}: AvatarGroupProps) {
  const visibleMembers = members.slice(0, max);
  const remainingCount = members.length - max;
  
  const sizeClasses = {
    sm: { avatar: "h-6 w-6", group: "-space-x-1", ring: "ring-1" },
    md: { avatar: "h-8 w-8", group: "-space-x-2", ring: "ring-2" },
    lg: { avatar: "h-10 w-10", group: "-space-x-3", ring: "ring-2" }
  };

  const { avatar: avatarSize, group: groupSpace, ring: ringSize } = sizeClasses[size];

  return (
    <div className={cn("flex overflow-hidden", groupSpace, className)}>
      {visibleMembers.map((member, index) => (
        <Avatar 
          key={index} 
          className={cn(
            avatarSize, 
            ringSize, 
            "ring-white relative inline-block"
          )}
        >
          <AvatarImage src={member.photoUrl} alt={member.name} />
          <AvatarFallback>
            {member.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {remainingCount > 0 && (
        <div className={cn(
          "relative inline-flex justify-center items-center",
          avatarSize,
          "bg-gray-100 text-gray-600 rounded-full",
          ringSize,
          "ring-white"
        )}>
          <span className="text-xs font-medium">+{remainingCount}</span>
        </div>
      )}
    </div>
  );
}
