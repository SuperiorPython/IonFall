using UnityEngine;

/// <summary>
/// Tracks per-run stats (enemies killed) and persists the all-time best
/// days-survived record across sessions via PlayerPrefs. Days survived itself
/// isn't tracked here — DayNightManager already owns that (CurrentDay) — this
/// just handles the "was that a new record" comparison and storage.
/// </summary>
public class ScoreManager : MonoBehaviour
{
    private const string BestDaysKey = "BestDaysSurvived";

    public int EnemiesKilled { get; private set; }
    public int BestDaysSurvived => PlayerPrefs.GetInt(BestDaysKey, 0);
    public bool LastRunWasNewRecord { get; private set; }

    private void OnEnable()
    {
        EnemyHealth.OnAnyEnemyDeath += HandleEnemyDeath;
    }

    private void OnDisable()
    {
        EnemyHealth.OnAnyEnemyDeath -= HandleEnemyDeath;
    }

    private void HandleEnemyDeath()
    {
        EnemiesKilled++;
    }

    /// <summary>Called by GameOverManager once, when the run ends.</summary>
    public void ReportRunEnded(int daysSurvived)
    {
        if (daysSurvived > BestDaysSurvived)
        {
            PlayerPrefs.SetInt(BestDaysKey, daysSurvived);
            PlayerPrefs.Save();
            LastRunWasNewRecord = true;
        }
        else
        {
            LastRunWasNewRecord = false;
        }
    }
}
