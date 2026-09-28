using UnityEngine;

/// <summary>
/// Holds the three upgrade branches (Turret/Dome/Mining) and handles cost scaling
/// and purchase logic. Rendering lives in DayScreenUI.cs — this class is pure
/// data + logic so the UI can be swapped out later without touching this.
/// </summary>
public class UpgradeSystem : MonoBehaviour
{
    [System.Serializable]
    public class Upgrade
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
    [SerializeField] private TurretShoot turretShoot;
    [SerializeField] private DomeHealth domeHealth;
    [SerializeField] private IonMiner ionMiner;

    [Header("Upgrade Definitions")]
    [SerializeField] private Upgrade fireRateUpgrade = new Upgrade { label = "Fire Rate", baseCost = 10, effectAmount = 1f };
    [SerializeField] private Upgrade maxIntegrityUpgrade = new Upgrade { label = "Max Integrity", baseCost = 15, effectAmount = 20f };
    [SerializeField] private Upgrade miningRateUpgrade = new Upgrade { label = "Mining Rate", baseCost = 12, effectAmount = 1f };

    public Upgrade FireRateUpgrade => fireRateUpgrade;
    public Upgrade MaxIntegrityUpgrade => maxIntegrityUpgrade;
    public Upgrade MiningRateUpgrade => miningRateUpgrade;

    public bool CanAfford(Upgrade upgrade) => ionManager != null && ionManager.CanAfford(upgrade.CurrentCost);

    public void BuyFireRate()
    {
        if (!TryPurchase(fireRateUpgrade)) return;
        turretShoot?.IncreaseFireRate(fireRateUpgrade.effectAmount);
    }

    public void BuyMaxIntegrity()
    {
        if (!TryPurchase(maxIntegrityUpgrade)) return;
        domeHealth?.IncreaseMaxIntegrity(maxIntegrityUpgrade.effectAmount);
    }

    public void BuyMiningRate()
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
}
