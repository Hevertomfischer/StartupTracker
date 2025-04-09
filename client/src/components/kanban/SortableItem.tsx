import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Startup } from "@shared/schema";
import { StartupCard } from "./StartupCard";

type SortableItemProps = {
  id: string;
  startup: Startup;
  onClickCard: (startup: Startup) => void;
  onDeleteCard: (startupId: string) => void;
};

export function SortableItem({ id, startup, onClickCard, onDeleteCard }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`mb-2 ${isDragging ? 'shadow-lg' : 'hover:shadow-md'}`}
      data-startup-id={startup.id}
    >
      <StartupCard
        startup={startup}
        onClick={() => onClickCard(startup)}
        onDelete={() => onDeleteCard(startup.id)}
      />
    </div>
  );
}