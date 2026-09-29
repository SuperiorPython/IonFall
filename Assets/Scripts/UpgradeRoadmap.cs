using System.Collections.Generic;

/// <summary>
/// REFERENCE / PLANNING FILE — not yet wired into gameplay.
///
/// This is the full 30-upgrade roadmap (10 per branch) as designed, kept here
/// as the single source of truth so it doesn't just live in chat history.
/// UpgradeSystem.cs currently only implements 3 upgrades (one per branch) with
/// a simple float-effect model — it does NOT yet read from this list.
///
/// When the real upgrade tree gets built, UpgradeSystem will need a more
/// general effect model (see the note in UpgradeDefinition below) rather than
/// the current one-float-per-upgrade approach, since several of these are
/// new behaviors, not just bigger numbers.
/// </summary>
public static class UpgradeRoadmap
{
    public enum Branch { Turret, Dome, Mining }

    /// <summary>
    /// EffectType is intentionally not yet connected to any code — it's here
    /// to show the shape UpgradeSystem's data model will eventually need.
    /// "StatBoost" upgrades fit the current system as-is; anything else
    /// (Special) represents new behavior the current system can't express yet.
    /// </summary>
    public enum EffectType { StatBoost, Special }

    public struct UpgradeDefinition
    {
        public Branch branch;
        public int tier; // 1-10
        public string name;
        public string description;
        public EffectType effectType;

        public UpgradeDefinition(Branch branch, int tier, string name, string description, EffectType effectType)
        {
            this.branch = branch;
            this.tier = tier;
            this.name = name;
            this.description = description;
            this.effectType = effectType;
        }
    }

    public static readonly List<UpgradeDefinition> All = new List<UpgradeDefinition>
    {
        // --- Turret Branch (Offense & Heat) ---
        new UpgradeDefinition(Branch.Turret, 1, "Rapid Fire I", "+10% fire rate", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Turret, 2, "Reinforced Barrel", "+15% bullet damage", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Turret, 3, "Coolant Injectors I", "+20% cooling speed", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Turret, 4, "Expanded Heat Sink", "+25% max heat capacity", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Turret, 5, "Rapid Fire II", "+15% fire rate (stacks with Rapid Fire I)", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Turret, 6, "Piercing Rounds", "Projectiles pass through 1 extra enemy", EffectType.Special),
        new UpgradeDefinition(Branch.Turret, 7, "Coolant Injectors II", "+30% cooling speed", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Turret, 8, "Twin Barrel", "Fires 2 projectiles per shot (slight spread)", EffectType.Special),
        new UpgradeDefinition(Branch.Turret, 9, "Overheat Vent", "Max heat no longer fully locks firing — just slows it", EffectType.Special),
        new UpgradeDefinition(Branch.Turret, 10, "Railgun Core", "Capstone: large damage boost + unique effect", EffectType.Special),

        // --- Dome Branch (Defense & Survivability) ---
        new UpgradeDefinition(Branch.Dome, 1, "Reinforced Plating I", "+20 max integrity", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Dome, 2, "Damage Dampeners I", "-10% incoming damage", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Dome, 3, "Auto-Repair Drone", "Slowly regenerates integrity over time", EffectType.Special),
        new UpgradeDefinition(Branch.Dome, 4, "Reinforced Plating II", "+30 max integrity", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Dome, 5, "Damage Dampeners II", "-15% incoming damage (stacks with Damage Dampeners I)", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Dome, 6, "Emergency Shield", "Once per night, absorbs the next hit for free", EffectType.Special),
        new UpgradeDefinition(Branch.Dome, 7, "Reinforced Plating III", "+50 max integrity", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Dome, 8, "Repair Efficiency", "Repair cards heal 50% more", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Dome, 9, "Adaptive Armor", "Damage resistance increases as integrity drops", EffectType.Special),
        new UpgradeDefinition(Branch.Dome, 10, "Fortress Core", "Capstone: large integrity + resistance boost", EffectType.Special),

        // --- Mining Branch (Economy) ---
        new UpgradeDefinition(Branch.Mining, 1, "Extraction Boost I", "+1 ion/tick", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Mining, 2, "Efficient Drills I", "Mining ticks 20% faster", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Mining, 3, "Second Miner", "Deploys an additional miner unit", EffectType.Special),
        new UpgradeDefinition(Branch.Mining, 4, "Extraction Boost II", "+2 ion/tick", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Mining, 5, "Efficient Drills II", "Mining ticks faster still", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Mining, 6, "Ion Refinery", "Small passive ion trickle, even outside mining ticks", EffectType.Special),
        new UpgradeDefinition(Branch.Mining, 7, "Third Miner", "Deploys a third miner unit", EffectType.Special),
        new UpgradeDefinition(Branch.Mining, 8, "Resource Optimization", "All upgrade costs reduced 10%", EffectType.Special),
        new UpgradeDefinition(Branch.Mining, 9, "Extraction Boost III", "+3 ion/tick", EffectType.StatBoost),
        new UpgradeDefinition(Branch.Mining, 10, "Ion Nexus", "Capstone: large overall mining multiplier", EffectType.Special),
    };
}
