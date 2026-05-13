import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import type { KanbanCard, KanbanBoard } from '@/types';

export function useKanban(teamId: string) {
  const qc = useQueryClient();

  useWebSocket(`/teams/${teamId}`, {
    'kanban:card-created': () => {
      qc.invalidateQueries({ queryKey: ['workspace', teamId] });
    },
    'kanban:card-updated': (payload) => {
      qc.setQueryData<{ board: KanbanBoard }>(['workspace', teamId], (old) => {
        if (!old) return old;
        const cardId = payload.card_id as string;
        const updater = (cards: KanbanCard[]) =>
          cards.map((c) => (c.id === cardId ? { ...c, ...(payload as Partial<KanbanCard>) } : c));
        return {
          board: {
            todo: updater(old.board.todo),
            in_progress: updater(old.board.in_progress),
            done: updater(old.board.done),
          },
        };
      });
    },
    'kanban:card-deleted': (payload) => {
      qc.setQueryData<{ board: KanbanBoard }>(['workspace', teamId], (old) => {
        if (!old) return old;
        const cardId = payload.card_id as string;
        const filter = (cards: KanbanCard[]) => cards.filter((c) => c.id !== cardId);
        return {
          board: {
            todo: filter(old.board.todo),
            in_progress: filter(old.board.in_progress),
            done: filter(old.board.done),
          },
        };
      });
    },
  });
}
