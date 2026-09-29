using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// Listens for DomeHealth's death event, freezes the game, and shows a
/// fullscreen stats/restart screen. Same disposable OnGUI pattern used
/// elsewhere — swap for real Canvas UI whenever the rest of the shop UI does.
/// </summary>
public class GameOverManager : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private DomeHealth domeHealth;
    [SerializeField] private ScoreManager scoreManager;
    [SerializeField] private DayNightManager dayNightManager;

    public bool IsGameOver { get; private set; }
    private int daysSurvivedThisRun;

    private void OnEnable()
    {
        if (domeHealth != null)
        {
            domeHealth.OnDomeDestroyed += HandleDomeDestroyed;
        }
    }

    private void OnDisable()
    {
        if (domeHealth != null)
        {
            domeHealth.OnDomeDestroyed -= HandleDomeDestroyed;
        }
    }

    private void HandleDomeDestroyed()
    {
        if (IsGameOver) return; // guard against the event firing more than once

        IsGameOver = true;
        daysSurvivedThisRun = dayNightManager != null ? dayNightManager.CurrentDay : 0;
        scoreManager?.ReportRunEnded(daysSurvivedThisRun);

        Time.timeScale = 0f;
    }

    private void RestartRun()
    {
        Time.timeScale = 1f; // reset before reload — a fresh scene shouldn't inherit a paused timescale
        SceneManager.LoadScene(SceneManager.GetActiveScene().name);
    }

    private void OnGUI()
    {
        if (!IsGameOver) return;

        DrawFullscreenOverlay();

        float centerX = Screen.width / 2f - 160f;
        float y = 120f;

        GUI.Label(new Rect(centerX, y, 320, 40), "GAME OVER", HeaderStyle());
        y += 60f;

        GUI.Label(new Rect(centerX, y, 320, 24), $"Days Survived: {daysSurvivedThisRun}");
        y += 30f;

        int killCount = scoreManager != null ? scoreManager.EnemiesKilled : 0;
        GUI.Label(new Rect(centerX, y, 320, 24), $"Enemies Eliminated: {killCount}");
        y += 30f;

        int best = scoreManager != null ? scoreManager.BestDaysSurvived : 0;
        string bestLabel = (scoreManager != null && scoreManager.LastRunWasNewRecord)
            ? $"Best: {best} days  🏆 NEW RECORD"
            : $"Best: {best} days";
        GUI.Label(new Rect(centerX, y, 320, 24), bestLabel);
        y += 50f;

        if (GUI.Button(new Rect(centerX, y, 320, 44), "Restart"))
        {
            RestartRun();
        }
    }

    private void DrawFullscreenOverlay()
    {
        var prevColor = GUI.color;
        GUI.color = new Color(0f, 0f, 0f, 0.9f);
        GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
        GUI.color = prevColor;
    }

    private GUIStyle HeaderStyle()
    {
        var style = new GUIStyle(GUI.skin.label);
        style.fontSize = 28;
        style.fontStyle = FontStyle.Bold;
        style.normal.textColor = Color.red;
        return style;
    }
}
