using UnityEngine;

/// <summary>
/// The dedicated Day screen: a fullscreen overlay shown while gameplay is
/// paused at the start of each Day. Shows all 30 upgrades (3 branches x 10
/// tiers) as a scrollable list per branch, plus repair cards and the
/// "Ready for Night" confirm button.
///
/// Still OnGUI, matching the rest of the project's placeholder UI — swap for
/// a real Canvas (with the branching visual layout discussed earlier) once
/// art/UI polish time comes around. UpgradeSystem doesn't care how it's
/// displayed, so that swap won't require touching upgrade logic.
/// </summary>
public class DayScreenUI : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private DayNightManager dayNightManager;
    [SerializeField] private IonManager ionManager;
    [SerializeField] private UpgradeSystem upgradeSystem;
    [SerializeField] private RepairCardSystem repairCardSystem;

    private Vector2 turretScroll;
    private Vector2 domeScroll;
    private Vector2 miningScroll;

    private void OnGUI()
    {
        if (dayNightManager == null || !dayNightManager.IsWaitingToConfirm) return;

        DrawFullscreenOverlay();

        float margin = 20f;
        float columnWidth = (Screen.width - margin * 4f) / 3f;
        float topY = 60f;
        float columnHeight = Screen.height - topY - 140f;

        GUI.Label(new Rect(margin, 15f, 400, 30), $"DAY {dayNightManager.CurrentDay} — Ions: {ionManager.CurrentIons}", HeaderStyle());

        DrawBranchColumn(margin, topY, columnWidth, columnHeight, UpgradeRoadmap.Branch.Turret, "TURRET", ref turretScroll);
        DrawBranchColumn(margin * 2f + columnWidth, topY, columnWidth, columnHeight, UpgradeRoadmap.Branch.Dome, "DOME", ref domeScroll);
        DrawBranchColumn(margin * 3f + columnWidth * 2f, topY, columnWidth, columnHeight, UpgradeRoadmap.Branch.Mining, "MINING", ref miningScroll);

        float bottomY = Screen.height - 110f;
        DrawRepairCardButton(margin, bottomY, columnWidth);

        if (GUI.Button(new Rect(Screen.width / 2f - 110f, bottomY, 220, 44), "Ready for Night"))
        {
            dayNightManager.ConfirmReadyForNight();
        }
    }

    private void DrawBranchColumn(float x, float y, float width, float height, UpgradeRoadmap.Branch branch, string title, ref Vector2 scroll)
    {
        GUI.Label(new Rect(x, y, width, 24), title, BranchHeaderStyle());
        y += 28f;

        scroll = GUI.BeginScrollView(new Rect(x, y, width, height), scroll, new Rect(0, 0, width - 20f, 10 * 44f));

        float rowY = 0f;
        for (int tier = 1; tier <= 10; tier++)
        {
            DrawUpgradeRow(0f, rowY, width - 24f, branch, tier);
            rowY += 44f;
        }

        GUI.EndScrollView();
    }

    private void DrawUpgradeRow(float x, float y, float width, UpgradeRoadmap.Branch branch, int tier)
    {
        var def = UpgradeRoadmap.Get(branch, tier);
        bool owned = upgradeSystem.IsPurchased(branch, tier);
        bool unlocked = upgradeSystem.IsUnlocked(branch, tier);
        bool affordable = upgradeSystem.CanAfford(branch, tier);

        string label;
        if (owned)
        {
            label = $"✓ {def.name}";
        }
        else
        {
            label = $"{(unlocked ? "" : "🔒 ")}{def.name} — {upgradeSystem.GetCost(branch, tier)} ions";
        }

        GUI.enabled = unlocked && !owned && affordable;
        if (GUI.Button(new Rect(x, y, width, 40), label))
        {
            upgradeSystem.TryPurchase(branch, tier);
        }
        GUI.enabled = true;
    }

    private void DrawRepairCardButton(float x, float y, float width)
    {
        bool canAfford = ionManager != null && ionManager.CanAfford(repairCardSystem.CardCost);
        string text = $"Buy Repair Card ({repairCardSystem.CardsOwned} owned) — {repairCardSystem.CardCost} ions";

        GUI.enabled = canAfford;
        if (GUI.Button(new Rect(x, y, width, 40), text))
        {
            repairCardSystem.BuyCard();
        }
        GUI.enabled = true;
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
        style.fontSize = 18;
        style.fontStyle = FontStyle.Bold;
        style.normal.textColor = Color.white;
        return style;
    }

    private GUIStyle BranchHeaderStyle()
    {
        var style = new GUIStyle(GUI.skin.label);
        style.fontSize = 14;
        style.fontStyle = FontStyle.Bold;
        style.normal.textColor = Color.yellow;
        return style;
    }
}
