using UnityEngine;

/// <summary>
/// Central source of truth for how enemies get tougher over time. Formulas are
/// intentionally simple linear curves for now — tune the per-night increments
/// during playtesting rather than the shape of the formula itself, unless
/// linear growth stops feeling right once real playtesting data comes in.
/// </summary>
public class DifficultyCurve : MonoBehaviour
{
    [Header("Per-night scaling (applied at spawn time)")]
    [SerializeField] private float healthGrowthPerNight = 0.04f;  // +4% enemy health per night — ~76% by Day 20, not Day 6
    [SerializeField] private float damageGrowthPerNight = 0.03f;  // +3% enemy attack damage per night
    [SerializeField] private float speedGrowthPerNight = 0.015f;  // +1.5% enemy move speed per night — kept small, speed compounds fast

    public float GetHealthMultiplier(int night) => 1f + healthGrowthPerNight * (night - 1);
    public float GetDamageMultiplier(int night) => 1f + damageGrowthPerNight * (night - 1);
    public float GetSpeedMultiplier(int night) => 1f + speedGrowthPerNight * (night - 1);
}
