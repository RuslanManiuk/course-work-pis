import { Link } from 'react-router-dom';
import type { HackathonWinner } from '@/api/hackathons';
import styles from './WinnersPodium.module.css';

const RANK_TEXT: Record<number, string> = {
  1: '[#1] first',
  2: '[#2] second',
  3: '[#3] third',
};

interface WinnersPodiumProps {
  winners: HackathonWinner[];
}

export default function WinnersPodium({ winners }: WinnersPodiumProps) {
  if (!winners.length) return null;

  const sorted = [...winners].sort((a, b) => a.rank - b.rank);
  const podium = sorted.filter((w) => w.rank <= 3);
  const runners = sorted.filter((w) => w.rank > 3);

  // Build podium positions explicitly so missing ranks don't collapse
  const byRank: Record<number, HackathonWinner | undefined> = {};
  for (const w of podium) byRank[w.rank] = w;

  return (
    <section className={styles.section} id="winners">
      <div>
        <span className={styles.sectionEyebrow}>// Winners</span>
        <h2 className={styles.sectionTitle}>
          $ cat <span className={styles.titleAccent}>winners.json</span>
        </h2>
      </div>

      <div className={styles.podium}>
        {byRank[2] && <PodiumSpot winner={byRank[2]} variant="silver" />}
        {byRank[1] && <PodiumSpot winner={byRank[1]} variant="gold" />}
        {byRank[3] && <PodiumSpot winner={byRank[3]} variant="bronze" />}
      </div>

      {runners.length > 0 && (
        <div className={styles.runners}>
          {runners.map((w) => (
            <Link
              key={w.id}
              to={`/workspace/${w.team_id}`}
              className={styles.runner}
              title={w.note ?? undefined}
            >
              <span className={styles.runnerRank}>#{w.rank}</span>
              <span className={styles.runnerName}>{w.team_name}</span>
              {w.prize && <span className={styles.runnerPrize}>{w.prize}</span>}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function PodiumSpot({
  winner,
  variant,
}: {
  winner: HackathonWinner;
  variant: 'gold' | 'silver' | 'bronze';
}) {
  const spotClass =
    variant === 'gold' ? styles.spotGold :
    variant === 'silver' ? styles.spotSilver :
    styles.spotBronze;
  const medalClass =
    variant === 'gold' ? styles.medalGold :
    variant === 'silver' ? styles.medalSilver :
    styles.medalBronze;

  return (
    <div className={`${styles.spot} ${spotClass}`}>
      <span className={`${styles.medal} ${medalClass}`}>
        {variant === 'gold' ? '1' : variant === 'silver' ? '2' : '3'}
      </span>
      <span className={styles.rankLabel}>{RANK_TEXT[winner.rank]}</span>
      <Link to={`/workspace/${winner.team_id}`} className={styles.teamName}>
        {winner.team_name}
      </Link>
      {winner.prize && <span className={styles.prize}>{winner.prize}</span>}
      {winner.note && <p className={styles.note}>{winner.note}</p>}
      {winner.avg_score != null && winner.avg_score > 0 && (
        <span className={styles.score}>avg score · {winner.avg_score.toFixed(2)}</span>
      )}
    </div>
  );
}
