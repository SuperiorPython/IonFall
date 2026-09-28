using UnityEngine;

/// <summary>
/// Generates ions passively, but only while it's night. Subscribes to
/// DayNightManager's phase events rather than checking phase every frame,
/// so it can't accidentally keep mining if the phase-check logic ever changes.
/// </summary>
public class IonMiner : MonoBehaviour
{
    [Header("Mining")]
    [SerializeField] private int ionsPerTick = 2;
    [SerializeField] private float tickInterval = 1f;

    [Header("References")]
    [SerializeField] private IonManager ionManager;
    [SerializeField] private DayNightManager dayNightManager;

    private bool isMining;
    private float tickTimer;

    private void OnEnable()
    {
        if (dayNightManager != null)
        {
            dayNightManager.OnNightStarted += HandleNightStarted;
            dayNightManager.OnDayStarted += HandleDayStarted;
        }
        else
        {
            Debug.LogWarning("IonMiner has no DayNightManager assigned — it will never mine.");
        }
    }

    private void OnDisable()
    {
        if (dayNightManager != null)
        {
            dayNightManager.OnNightStarted -= HandleNightStarted;
            dayNightManager.OnDayStarted -= HandleDayStarted;
        }
    }

    private void HandleNightStarted(int nightNumber)
    {
        isMining = true;
        tickTimer = 0f; // start producing right away rather than waiting a full interval
    }

    private void HandleDayStarted(int dayNumber)
    {
        isMining = false;
    }

    /// <summary>Called by UpgradeSystem when the player buys a mining rate upgrade.</summary>
    public void IncreaseMiningRate(int amount)
    {
        ionsPerTick += amount;
    }

    private void Update()
    {
        if (!isMining) return;

        tickTimer -= Time.deltaTime;
        if (tickTimer <= 0f)
        {
            ionManager?.Add(ionsPerTick);
            tickTimer = tickInterval;
        }
    }
}
