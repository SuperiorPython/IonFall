using UnityEngine;

/// <summary>
/// The dedicated Day screen: a fullscreen overlay shown while gameplay is
/// paused (Time.timeScale == 0) at the start of each Day. Lets the player
/// buy upgrades and repair cards with no time pressure, then confirms
/// "Ready for Night" to unpause and let the day timer start counting down.
///
/// Built with OnGUI for now (matches the rest of the project's placeholder UI) —
/// swap this for a real Canvas in the spring polish pass without touching
/// UpgradeSystem/RepairCardSystem/DayNightManager, since none of those know
/// or care how they're being displayed.
/// </summary>
public class DayScreenUI : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private DayNightManager dayNightManager;
    [SerializeField] private IonManager ionManager;
    [SerializeField] private UpgradeSystem upgradeSystem;
    [SerializeField] private RepairCardSystem repairCardSystem;

    private void OnGUI()
    {
        if (dayNightManager == null || !dayNightManager.IsWaitingToConfirm) return;

        DrawFullscreenOverlay();

        float centerX = Screen.width / 2f - 160f;
        float y = 60f;

        GUI.Label(new Rect(centerX, y, 320, 30), $"DAY {dayNightManager.CurrentDay} — PREPARE FOR NIGHT", HeaderStyle());
        y += 40f;

        GUI.Label(new Rect(centerX, y, 320, 24), $"Ions: {ionManager.CurrentIons}");
        y += 40f;

        DrawUpgradeButton(centerX, y, upgradeSystem.FireRateUpgrade, upgradeSystem.BuyFireRate);
        y += 40f;
        DrawUpgradeButton(centerX, y, upgradeSystem.MaxIntegrityUpgrade, upgradeSystem.BuyMaxIntegrity);
        y += 40f;
        DrawUpgradeButton(centerX, y, upgradeSystem.MiningRateUpgrade, upgradeSystem.BuyMiningRate);
        y += 50f;

        DrawRepairCardButton(centerX, y);
        y += 60f;

        if (GUI.Button(new Rect(centerX, y, 320, 44), "Ready for Night"))
        {
            dayNightManager.ConfirmReadyForNight();
        }
    }

    private void DrawUpgradeButton(float x, float y, UpgradeSystem.Upgrade upgrade, System.Action onBuy)
    {
        bool canAfford = upgradeSystem.CanAfford(upgrade);
        string text = $"{upgrade.label} (Lv {upgrade.level}) — {upgrade.CurrentCost} ions";

        GUI.enabled = canAfford;
        if (GUI.Button(new Rect(x, y, 320, 32), text))
        {
            onBuy?.Invoke();
        }
        GUI.enabled = true;
    }

    private void DrawRepairCardButton(float x, float y)
    {
        bool canAfford = ionManager != null && ionManager.CanAfford(repairCardSystem.CardCost);
        string text = $"Buy Repair Card ({repairCardSystem.CardsOwned} owned) — {repairCardSystem.CardCost} ions";

        GUI.enabled = canAfford;
        if (GUI.Button(new Rect(x, y, 320, 32), text))
        {
            repairCardSystem.BuyCard();
        }
        GUI.enabled = true;
    }

    private void DrawFullscreenOverlay()
    {
        var prevColor = GUI.color;
        GUI.color = new Color(0f, 0f, 0f, 0.85f);
        GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
        GUI.color = prevColor;
    }

    private GUIStyle HeaderStyle()
    {
        var style = new GUIStyle(GUI.skin.label);
        style.fontSize = 18;
        style.fontStyle = FontStyle.Bold;
        style.normal.textColor = Color.white;
        return style;
    }
}
