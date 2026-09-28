using UnityEngine;

/// <summary>
/// TEMPORARY debug display for phase/day/timer. Same throwaway pattern as
/// HeatDebugDisplay — delete or replace once real UI exists.
/// Attach to the same object as DayNightManager.
/// </summary>
[RequireComponent(typeof(DayNightManager))]
public class DayNightDebugDisplay : MonoBehaviour
{
    private DayNightManager dayNightManager;

    private void Awake()
    {
        dayNightManager = GetComponent<DayNightManager>();
    }

    private void OnGUI()
    {
        string phaseLabel = dayNightManager.CurrentPhase == DayNightManager.Phase.Night ? "NIGHT" : "DAY";
        GUI.Label(new Rect(20, 60, 300, 24),
            $"{phaseLabel} {dayNightManager.CurrentDay} — {dayNightManager.PhaseTimeRemaining:F1}s remaining");
    }
}
