using UnityEngine;

/// <summary>
/// Shows a fullscreen title screen and holds the game paused until the player
/// clicks Start. DayNightManager already stays paused with HasStarted == false
/// on scene load — this just gives the player a screen and a button to move
/// past that, then calls BeginGame() to kick things off for real.
/// </summary>
public class TitleScreenUI : MonoBehaviour
{
    [SerializeField] private DayNightManager dayNightManager;
    [SerializeField] private string gameTitle = "IONFALL";
    [SerializeField] private string subtitle = "Survive the fall.";

    private void OnGUI()
    {
        if (dayNightManager == null || dayNightManager.HasStarted) return;

        DrawFullscreenOverlay();

        float centerX = Screen.width / 2f - 200f;
        float y = Screen.height / 2f - 100f;

        GUI.Label(new Rect(centerX, y, 400, 60), gameTitle, TitleStyle());
        y += 70f;

        GUI.Label(new Rect(centerX, y, 400, 30), subtitle, SubtitleStyle());
        y += 70f;

        if (GUI.Button(new Rect(centerX + 100f, y, 200, 50), "Start Game"))
        {
            dayNightManager.BeginGame();
        }
    }

    private void DrawFullscreenOverlay()
    {
        var prevColor = GUI.color;
        GUI.color = new Color(0.02f, 0.02f, 0.05f, 1f); // solid dark backdrop, not translucent — this IS the screen
        GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
        GUI.color = prevColor;
    }

    private GUIStyle TitleStyle()
    {
        var style = new GUIStyle(GUI.skin.label);
        style.fontSize = 42;
        style.fontStyle = FontStyle.Bold;
        style.alignment = TextAnchor.MiddleCenter;
        style.normal.textColor = Color.white;
        return style;
    }

    private GUIStyle SubtitleStyle()
    {
        var style = new GUIStyle(GUI.skin.label);
        style.fontSize = 16;
        style.alignment = TextAnchor.MiddleCenter;
        style.normal.textColor = Color.gray;
        return style;
    }
}
