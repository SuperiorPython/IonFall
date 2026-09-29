using System;
using UnityEngine;

/// <summary>
/// Tracks the dome's integrity (health). Fires an event when the dome dies.
/// Attach this to the Dome GameObject.
/// </summary>
public class DomeHealth : MonoBehaviour
{
    [Header("Integrity Settings")]
    [SerializeField] private float maxIntegrity = 100f;
    [SerializeField] private float currentIntegrity;

    [Header("References")]
    [SerializeField] private DayNightManager dayNightManager; // optional — needed for Emergency Shield's per-night reset

    public event Action<float, float> OnIntegrityChanged; // (current, max)
    public event Action OnDomeDestroyed;

    public float CurrentIntegrity => currentIntegrity;
    public float MaxIntegrity => maxIntegrity;
    public bool IsDestroyed => currentIntegrity <= 0f;

    // --- Upgrade-driven state ---
    private float damageResistance = 0f; // 0-1, fraction of incoming damage blocked
    private float regenPerSecond = 0f;
    private bool hasEmergencyShield = false;
    private bool shieldChargeAvailable = false;
    private bool hasAdaptiveArmor = false;
    private float adaptiveArmorMaxBonus = 0f; // extra resistance at 0 integrity

    private void Awake()
    {
        currentIntegrity = maxIntegrity;
    }

    private void OnEnable()
    {
        if (dayNightManager != null)
        {
            dayNightManager.OnNightStarted += HandleNightStarted;
        }
    }

    private void OnDisable()
    {
        if (dayNightManager != null)
        {
            dayNightManager.OnNightStarted -= HandleNightStarted;
        }
    }

    private void HandleNightStarted(int night)
    {
        if (hasEmergencyShield)
        {
            shieldChargeAvailable = true; // recharge at the start of every night
        }
    }

    private void Update()
    {
        if (regenPerSecond > 0f && !IsDestroyed)
        {
            Repair(regenPerSecond * Time.deltaTime);
        }

        // TEMPORARY test hook — press Space to simulate 10 damage for quick testing.
        if (Input.GetKeyDown(KeyCode.Space))
        {
            TakeDamage(10f);
        }
    }

    public void TakeDamage(float amount)
    {
        if (IsDestroyed || amount <= 0f) return;

        if (hasEmergencyShield && shieldChargeAvailable)
        {
            shieldChargeAvailable = false;
            Debug.Log("Emergency Shield absorbed a hit!");
            return; // fully absorbed, no damage this time
        }

        float totalResistance = damageResistance;
        if (hasAdaptiveArmor)
        {
            float missingHealthPct = 1f - (currentIntegrity / maxIntegrity);
            totalResistance += adaptiveArmorMaxBonus * missingHealthPct;
        }
        totalResistance = Mathf.Clamp01(totalResistance);

        float finalDamage = amount * (1f - totalResistance);

        currentIntegrity = Mathf.Max(0f, currentIntegrity - finalDamage);
        OnIntegrityChanged?.Invoke(currentIntegrity, maxIntegrity);

        if (currentIntegrity <= 0f)
        {
            Die();
        }
    }

    public void Repair(float amount)
    {
        if (IsDestroyed || amount <= 0f) return;

        currentIntegrity = Mathf.Min(maxIntegrity, currentIntegrity + amount);
        OnIntegrityChanged?.Invoke(currentIntegrity, maxIntegrity);
    }

    private void Die()
    {
        OnDomeDestroyed?.Invoke();
    }

    // --- Upgrade hooks, called by UpgradeSystem ---

    public void IncreaseMaxIntegrity(float amount)
    {
        if (amount <= 0f) return;

        maxIntegrity += amount;
        currentIntegrity += amount;
        OnIntegrityChanged?.Invoke(currentIntegrity, maxIntegrity);
    }

    public void IncreaseDamageResistance(float percent) => damageResistance += percent;
    public void EnableAutoRepair(float amountPerSecond) => regenPerSecond += amountPerSecond;
    public void EnableEmergencyShield() => hasEmergencyShield = true;
    public void EnableAdaptiveArmor(float maxBonusResistance)
    {
        hasAdaptiveArmor = true;
        adaptiveArmorMaxBonus = maxBonusResistance;
    }
}
