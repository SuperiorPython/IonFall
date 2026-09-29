using UnityEngine;

/// <summary>
/// Generates ions passively, but only while it's night. Subscribes to
/// DayNightManager's phase events rather than checking phase every frame.
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

    // --- Upgrade-driven state ---
    private float outputMultiplier = 1f; // Second Miner, Third Miner, and Ion Nexus all stack into this one multiplier
    private float refineryTrickleRate = 0f; // ions/sec, active even during Day
    private float refineryTimer;

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
        tickTimer = 0f;
    }

    private void HandleDayStarted(int dayNumber)
    {
        isMining = false;
    }

    private void Update()
    {
        if (isMining)
        {
            tickTimer -= Time.deltaTime;
            if (tickTimer <= 0f)
            {
                int amount = Mathf.RoundToInt(ionsPerTick * outputMultiplier);
                ionManager?.Add(amount);
                tickTimer = tickInterval;
            }
        }

        // Ion Refinery trickle runs independent of night/day, once purchased.
        if (refineryTrickleRate > 0f)
        {
            refineryTimer -= Time.deltaTime;
            if (refineryTimer <= 0f)
            {
                ionManager?.Add(Mathf.Max(1, Mathf.RoundToInt(refineryTrickleRate)));
                refineryTimer = 1f;
            }
        }
    }

    // --- Upgrade hooks, called by UpgradeSystem ---

    public void IncreaseMiningRate(int amount) => ionsPerTick += amount;
    public void IncreaseTickSpeed(float percent) => tickInterval = Mathf.Max(0.1f, tickInterval * (1f - percent));
    public void IncreaseOutputMultiplier(float percent) => outputMultiplier *= (1f + percent);
    public void EnableRefinery(float amountPerSecond) => refineryTrickleRate += amountPerSecond;
}
