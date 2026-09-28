using UnityEngine;

/// <summary>
/// Holds the three upgrade branches (Turret/Dome/Mining), handles cost scaling
/// and purchase logic, and renders a temporary OnGUI shop panel that's only
/// interactable during Day. Real UI can replace the OnGUI portion later without
/// touching the upgrade logic itself.
/// </summary>
public class UpgradeSystem : MonoBehaviour
{
    [System.Serializable]
    private class Upgrade
    {
        public string label;
        public int level;
        public int baseCost = 10;
        public float costGrowth = 1.5f; // cost multiplier per level, matches "escalating costs" from the design doc
        public float effectAmount;

        public int CurrentCost => Mathf.RoundToInt(baseCost * Mathf.Pow(costGrowth, level));
    }

    [Header("References")]
    [SerializeField] private IonManager ionManager;
    [SerializeField] private DayNightManager dayNightManager;
    [SerializeField] private TurretShoot turretShoot;
    [SerializeField] private DomeHealth domeHealth;
    [SerializeField] private IonMiner ionMiner;

    [Header("Upgrade Definitions")]
    [SerializeField] private Upgrade fireRateUpgrade = new Upgrade { label = "Fire Rate", baseCost = 10, effectAmount = 1f };
    [SerializeField] private Upgrade maxIntegrityUpgrade = new Upgrade { label = "Max Integrity", baseCost = 15, effectAmount = 20f };
    [SerializeField] private Upgrade miningRateUpgrade = new Upgrade { label = "Mining Rate", baseCost = 12, effectAmount = 1f };

    private bool isDayPhase;

    private void OnEnable()
    {
        if (dayNightManager != null)
        {
            dayNightManager.OnDayStarted += HandleDayStarted;
            dayNightManager.OnNightStarted += HandleNightStarted;
        }
    }

    private void OnDisable()
    {
        if (dayNightManager != null)
        {
            dayNightManager.OnDayStarted -= HandleDayStarted;
            dayNightManager.OnNightStarted -= HandleNightStarted;
        }
    }

    private void HandleDayStarted(int day) => isDayPhase = true;
    private void HandleNightStarted(int night) => isDayPhase = false;

    private void BuyFireRate()
    {
        if (!TryPurchase(fireRateUpgrade)) return;
        turretShoot?.IncreaseFireRate(fireRateUpgrade.effectAmount);
    }

    private void BuyMaxIntegrity()
    {
        if (!TryPurchase(maxIntegrityUpgrade)) return;
        domeHealth?.IncreaseMaxIntegrity(maxIntegrityUpgrade.effectAmount);
    }

    private void BuyMiningRate()
    {
        if (!TryPurchase(miningRateUpgrade)) return;
        ionMiner?.IncreaseMiningRate((int)miningRateUpgrade.effectAmount);
    }

    private bool TryPurchase(Upgrade upgrade)
    {
        if (ionManager == null) return false;
        if (!ionManager.Spend(upgrade.CurrentCost)) return false;

        upgrade.level++;
        return true;
    }

    // --- Temporary OnGUI shop panel ---
    private void OnGUI()
    {
        if (!isDayPhase)
        {
            GUI.Label(new Rect(20, 120, 300, 24), "Shop closed (night phase)");
            return;
        }

        DrawUpgradeButton(120, fireRateUpgrade, BuyFireRate);
        DrawUpgradeButton(160, maxIntegrityUpgrade, BuyMaxIntegrity);
        DrawUpgradeButton(200, miningRateUpgrade, BuyMiningRate);
    }

    private void DrawUpgradeButton(int y, Upgrade upgrade, System.Action onBuy)
    {
        bool canAfford = ionManager != null && ionManager.CanAfford(upgrade.CurrentCost);
        string text = $"{upgrade.label} (Lv {upgrade.level}) — {upgrade.CurrentCost} ions";

        GUI.enabled = canAfford;
        if (GUI.Button(new Rect(20, y, 260, 30), text))
        {
            onBuy?.Invoke();
        }
        GUI.enabled = true;
    }
}
