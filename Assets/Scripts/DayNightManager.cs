using System;
using UnityEngine;

/// <summary>
/// Drives the core day/night loop. Owns phase state and timing; tells
/// EnemySpawner when to start/stop rather than the spawner deciding for itself.
/// Other systems (mining, shop UI, etc.) should subscribe to the events below
/// rather than polling this script's phase every frame.
/// </summary>
public class DayNightManager : MonoBehaviour
{
    public enum Phase { Day, Night }

    [Header("Timing (seconds)")]
    [SerializeField] private float dayDuration = 20f;
    [SerializeField] private float nightDuration = 30f;
    [SerializeField] private bool startInDay = true; // brief prep before the first night

    [Header("References")]
    [SerializeField] private EnemySpawner enemySpawner;

    public Phase CurrentPhase { get; private set; }
    public int CurrentDay { get; private set; } = 1;
    public float PhaseTimeRemaining { get; private set; }
    public bool HasStarted { get; private set; }

    // Subscribe to these instead of checking CurrentPhase every frame.
    public event Action<int> OnNightStarted;  // passes night/day number
    public event Action<int> OnDayStarted;

    private void Start()
    {
        CurrentPhase = startInDay ? Phase.Day : Phase.Night;
        PhaseTimeRemaining = startInDay ? dayDuration : nightDuration;

        // Stay paused and don't fire any phase-start events yet — the title
        // screen calls BeginGame() once the player clicks Start.
        Time.timeScale = 0f;
    }

    /// <summary>Called by TitleScreenUI when the player clicks "Start Game".</summary>
    public void BeginGame()
    {
        if (HasStarted) return;
        HasStarted = true;

        if (CurrentPhase == Phase.Night)
        {
            BeginNight();
        }
        else
        {
            BeginDay();
        }
    }

    private void Update()
    {
        PhaseTimeRemaining -= Time.deltaTime;
        if (PhaseTimeRemaining <= 0f)
        {
            AdvancePhase();
        }
    }

    private void AdvancePhase()
    {
        if (CurrentPhase == Phase.Day)
        {
            BeginNight();
        }
        else
        {
            CurrentDay++;
            BeginDay();
        }
    }

    private void BeginNight()
    {
        CurrentPhase = Phase.Night;
        PhaseTimeRemaining = nightDuration;
        Time.timeScale = 1f; // defensive — should already be 1, but night should never be paused

        enemySpawner?.StartSpawning(CurrentDay);
        OnNightStarted?.Invoke(CurrentDay);
    }

    private void BeginDay()
    {
        CurrentPhase = Phase.Day;
        PhaseTimeRemaining = dayDuration;
        Time.timeScale = 0f; // freeze gameplay until the player confirms they're ready

        enemySpawner?.StopSpawning();
        OnDayStarted?.Invoke(CurrentDay);
    }

    /// <summary>
    /// Called by the shop UI's "Ready for Night" button. Unpauses gameplay,
    /// at which point the day timer (already set to dayDuration in BeginDay)
    /// starts counting down toward night for real.
    /// </summary>
    public void ConfirmReadyForNight()
    {
        if (CurrentPhase != Phase.Day) return;
        Time.timeScale = 1f;
    }

    public bool IsWaitingToConfirm => HasStarted && CurrentPhase == Phase.Day && Time.timeScale == 0f;
}
