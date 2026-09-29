using System.Collections.Generic;

/// <summary>
/// The full 30-upgrade roadmap (10 per branch), now with real costs and
/// effect values — this is what UpgradeSystem reads from at runtime.
/// StatBoost upgrades use effectValue directly (as a percentage or flat
/// amount depending on the upgrade — see ApplyEffect in UpgradeSystem for
/// exactly how each one is interpreted). Special upgrades mostly ignore
/// effectValue and are handled by dedicated logic instead.
/// </summary>
public static class UpgradeRoadmap
{
    public enum Branch { Turret, Dome, Mining }
    public enum EffectType { StatBoost, Special }

    public struct UpgradeDefinition
    {
        public Branch branch;
        public int tier; // 1-10
        public string name;
        public string description;
        public EffectType effectType;
        public int cost;
        public float effectValue;

        public UpgradeDefinition(Branch branch, int tier, string name, string description, EffectType effectType, int cost, float effectValue)
        {
            this.branch = branch;
            this.tier = tier;
            this.name = name;
            this.description = description;
            this.effectType = effectType;
            this.cost = cost;
            this.effectValue = effectValue;
        }
    }

    public static readonly List<UpgradeDefinition> All = new List<UpgradeDefinition>
    {
        // --- Turret Branch (Offense & Heat) ---
        new UpgradeDefinition(Branch.Turret, 1, "Rapid Fire I", "+10% fire rate", EffectType.StatBoost, 8, 0.10f),
        new UpgradeDefinition(Branch.Turret, 2, "Reinforced Barrel", "+15% bullet damage", EffectType.StatBoost, 10, 0.15f),
        new UpgradeDefinition(Branch.Turret, 3, "Coolant Injectors I", "+20% cooling speed", EffectType.StatBoost, 13, 0.20f),
        new UpgradeDefinition(Branch.Turret, 4, "Expanded Heat Sink", "+25% max heat capacity", EffectType.StatBoost, 16, 0.25f),
        new UpgradeDefinition(Branch.Turret, 5, "Rapid Fire II", "+15% fire rate (stacks)", EffectType.StatBoost, 20, 0.15f),
        new UpgradeDefinition(Branch.Turret, 6, "Piercing Rounds", "Projectiles pierce 1 extra enemy", EffectType.Special, 25, 1f),
        new UpgradeDefinition(Branch.Turret, 7, "Coolant Injectors II", "+30% cooling speed", EffectType.StatBoost, 30, 0.30f),
        new UpgradeDefinition(Branch.Turret, 8, "Twin Barrel", "Fires 2 projectiles per shot", EffectType.Special, 38, 0f),
        new UpgradeDefinition(Branch.Turret, 9, "Overheat Vent", "Overheat slows firing instead of blocking it", EffectType.Special, 46, 0f),
        new UpgradeDefinition(Branch.Turret, 10, "Railgun Core", "Capstone: +100% damage, +2 pierce", EffectType.Special, 60, 0f),

        // --- Dome Branch (Defense & Survivability) ---
        new UpgradeDefinition(Branch.Dome, 1, "Reinforced Plating I", "+20 max integrity", EffectType.StatBoost, 8, 20f),
        new UpgradeDefinition(Branch.Dome, 2, "Damage Dampeners I", "-10% incoming damage", EffectType.StatBoost, 10, 0.10f),
        new UpgradeDefinition(Branch.Dome, 3, "Auto-Repair Drone", "Regenerates 1 integrity/sec", EffectType.Special, 13, 1f),
        new UpgradeDefinition(Branch.Dome, 4, "Reinforced Plating II", "+30 max integrity", EffectType.StatBoost, 16, 30f),
        new UpgradeDefinition(Branch.Dome, 5, "Damage Dampeners II", "-15% incoming damage (stacks)", EffectType.StatBoost, 20, 0.15f),
        new UpgradeDefinition(Branch.Dome, 6, "Emergency Shield", "Once per night, absorb the next hit free", EffectType.Special, 25, 0f),
        new UpgradeDefinition(Branch.Dome, 7, "Reinforced Plating III", "+50 max integrity", EffectType.StatBoost, 30, 50f),
        new UpgradeDefinition(Branch.Dome, 8, "Repair Efficiency", "Repair cards heal 50% more", EffectType.StatBoost, 38, 0.50f),
        new UpgradeDefinition(Branch.Dome, 9, "Adaptive Armor", "Resistance increases as integrity drops", EffectType.Special, 46, 0.30f),
        new UpgradeDefinition(Branch.Dome, 10, "Fortress Core", "Capstone: +80 integrity, +20% resistance", EffectType.Special, 60, 0f),

        // --- Mining Branch (Economy) ---
        new UpgradeDefinition(Branch.Mining, 1, "Extraction Boost I", "+1 ion/tick", EffectType.StatBoost, 8, 1f),
        new UpgradeDefinition(Branch.Mining, 2, "Efficient Drills I", "Mining ticks 15% faster", EffectType.StatBoost, 10, 0.15f),
        new UpgradeDefinition(Branch.Mining, 3, "Second Miner", "+30% mining output", EffectType.Special, 13, 0.30f),
        new UpgradeDefinition(Branch.Mining, 4, "Extraction Boost II", "+1 ion/tick", EffectType.StatBoost, 16, 1f),
        new UpgradeDefinition(Branch.Mining, 5, "Efficient Drills II", "Mining ticks 10% faster still", EffectType.StatBoost, 20, 0.10f),
        new UpgradeDefinition(Branch.Mining, 6, "Ion Refinery", "Passive ion trickle, even during day", EffectType.Special, 25, 0.5f),
        new UpgradeDefinition(Branch.Mining, 7, "Third Miner", "+30% mining output", EffectType.Special, 30, 0.30f),
        new UpgradeDefinition(Branch.Mining, 8, "Resource Optimization", "All upgrade costs reduced 10%", EffectType.Special, 38, 0.10f),
        new UpgradeDefinition(Branch.Mining, 9, "Extraction Boost III", "+2 ion/tick", EffectType.StatBoost, 46, 2f),
        new UpgradeDefinition(Branch.Mining, 10, "Ion Nexus", "Capstone: +40% mining output", EffectType.Special, 60, 0.40f),
    };

    public static UpgradeDefinition Get(Branch branch, int tier)
    {
        return All.Find(u => u.branch == branch && u.tier == tier);
    }
}
