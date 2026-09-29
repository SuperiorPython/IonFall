using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Data-driven upgrade purchasing across all 3 branches (10 tiers each),
/// reading definitions from UpgradeRoadmap. Enforces the "straight-line"
/// prerequisite rule (tier N requires tier N-1 already owned), tracks what's
/// purchased for the current run, and dispatches each purchase to the
/// specific system it affects. Rendering lives in DayScreenUI.
/// </summary>
public class UpgradeSystem : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private IonManager ionManager;
    [SerializeField] private TurretShoot turretShoot;
    [SerializeField] private DomeHealth domeHealth;
    [SerializeField] private IonMiner ionMiner;
    [SerializeField] private RepairCardSystem repairCardSystem;

    [Header("Token Threshold (escalates with every purchase)")]
    [SerializeField] private int baseThreshold = 50; // current ions needed for your 1st token
    [SerializeField] private float thresholdGrowthPerPurchase = 1.1f; // +10% threshold needed after every purchase, any type

    private readonly HashSet<(UpgradeRoadmap.Branch, int)> purchased = new HashSet<(UpgradeRoadmap.Branch, int)>();
    private int totalPurchasedCount = 0; // across ALL branches + repair cards — drives the growing threshold
    private float thresholdMultiplier = 1f; // Resource Optimization — lowers this, making tokens easier to reach

    public bool IsPurchased(UpgradeRoadmap.Branch branch, int tier) => purchased.Contains((branch, tier));

    public bool IsUnlocked(UpgradeRoadmap.Branch branch, int tier)
    {
        if (tier <= 1) return true;
        return IsPurchased(branch, tier - 1);
    }

    /// <summary>
    /// How many current ions are needed to have a token available right now.
    /// Discounted by Resource Optimization if owned, then scaled up by how many
    /// purchases total have already happened — upgrades AND repair cards both
    /// count, so the threshold for your next token keeps climbing either way.
    /// </summary>
    public int GetCurrentCost()
    {
        float scaledThreshold = baseThreshold * thresholdMultiplier * Mathf.Pow(thresholdGrowthPerPurchase, totalPurchasedCount);
        return Mathf.RoundToInt(scaledThreshold);
    }

    public int GetCost(UpgradeRoadmap.Branch branch, int tier) => GetCurrentCost();

    /// <summary>True if current ion balance meets the threshold for a token.</summary>
    public bool CanAfford(UpgradeRoadmap.Branch branch, int tier)
    {
        return ionManager != null && ionManager.CurrentIons >= GetCurrentCost();
    }

    /// <summary>
    /// Spends ions at the current threshold, then advances the shared counter —
    /// which raises the threshold needed for the NEXT token. Public so
    /// RepairCardSystem can consume a token the exact same way.
    /// </summary>
    public bool ConsumeToken()
    {
        if (ionManager == null || !ionManager.Spend(GetCurrentCost())) return false;
        totalPurchasedCount++;
        return true;
    }

    /// <summary>Attempts to buy the given upgrade using a token.</summary>
    public bool TryPurchase(UpgradeRoadmap.Branch branch, int tier)
    {
        if (IsPurchased(branch, tier)) return false;
        if (!IsUnlocked(branch, tier)) return false;
        if (!ConsumeToken()) return false;

        purchased.Add((branch, tier));
        ApplyEffect(branch, tier);
        return true;
    }

    private void ApplyEffect(UpgradeRoadmap.Branch branch, int tier)
    {
        var def = UpgradeRoadmap.Get(branch, tier);
        float v = def.effectValue;

        switch (branch)
        {
            case UpgradeRoadmap.Branch.Turret:
                switch (tier)
                {
                    case 1: turretShoot?.IncreaseFireRate(v); break;             // Rapid Fire I
                    case 2: turretShoot?.IncreaseDamage(v); break;               // Reinforced Barrel
                    case 3: turretShoot?.IncreaseCoolRate(v); break;             // Coolant Injectors I
                    case 4: turretShoot?.IncreaseMaxHeat(v); break;              // Expanded Heat Sink
                    case 5: turretShoot?.IncreaseFireRate(v); break;             // Rapid Fire II
                    case 6: turretShoot?.AddPierce(1); break;                    // Piercing Rounds
                    case 7: turretShoot?.IncreaseCoolRate(v); break;             // Coolant Injectors II
                    case 8: turretShoot?.EnableTwinBarrel(); break;              // Twin Barrel
                    case 9: turretShoot?.EnableOverheatVent(); break;            // Overheat Vent
                    case 10:                                                    // Railgun Core (capstone)
                        turretShoot?.IncreaseDamage(1.0f);
                        turretShoot?.AddPierce(2);
                        break;
                }
                break;

            case UpgradeRoadmap.Branch.Dome:
                switch (tier)
                {
                    case 1: domeHealth?.IncreaseMaxIntegrity(v); break;          // Reinforced Plating I
                    case 2: domeHealth?.IncreaseDamageResistance(v); break;      // Damage Dampeners I
                    case 3: domeHealth?.EnableAutoRepair(v); break;              // Auto-Repair Drone
                    case 4: domeHealth?.IncreaseMaxIntegrity(v); break;          // Reinforced Plating II
                    case 5: domeHealth?.IncreaseDamageResistance(v); break;      // Damage Dampeners II
                    case 6: domeHealth?.EnableEmergencyShield(); break;          // Emergency Shield
                    case 7: domeHealth?.IncreaseMaxIntegrity(v); break;          // Reinforced Plating III
                    case 8: repairCardSystem?.IncreaseRepairEfficiency(v); break;// Repair Efficiency
                    case 9: domeHealth?.EnableAdaptiveArmor(v); break;           // Adaptive Armor
                    case 10:                                                    // Fortress Core (capstone)
                        domeHealth?.IncreaseMaxIntegrity(80f);
                        domeHealth?.IncreaseDamageResistance(0.20f);
                        break;
                }
                break;

            case UpgradeRoadmap.Branch.Mining:
                switch (tier)
                {
                    case 1: ionMiner?.IncreaseMiningRate((int)v); break;         // Extraction Boost I
                    case 2: ionMiner?.IncreaseTickSpeed(v); break;               // Efficient Drills I
                    case 3: ionMiner?.IncreaseOutputMultiplier(v); break;         // Second Miner (+output)
                    case 4: ionMiner?.IncreaseMiningRate((int)v); break;         // Extraction Boost II
                    case 5: ionMiner?.IncreaseTickSpeed(v); break;               // Efficient Drills II
                    case 6: ionMiner?.EnableRefinery(v); break;                  // Ion Refinery
                    case 7: ionMiner?.IncreaseOutputMultiplier(v); break;         // Third Miner (+output)
                    case 8: thresholdMultiplier *= (1f - v); break;               // Resource Optimization
                    case 9: ionMiner?.IncreaseMiningRate((int)v); break;         // Extraction Boost III
                    case 10: ionMiner?.IncreaseOutputMultiplier(v); break;       // Ion Nexus (capstone)
                }
                break;
        }
    }
}
