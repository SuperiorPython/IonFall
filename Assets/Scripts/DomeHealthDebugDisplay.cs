using UnityEngine;

/// <summary>
/// TEMPORARY debug display for dome integrity. Same throwaway pattern as the
/// heat, day/night, and ion displays — delete or replace once real UI exists.
/// Attach to the same object as DomeHealth (the Dome itself).
/// </summary>
[RequireComponent(typeof(DomeHealth))]
public class DomeHealthDebugDisplay : MonoBehaviour
{
    private DomeHealth domeHealth;

    private void Awake()
    {
        domeHealth = GetComponent<DomeHealth>();
    }

    private void OnGUI()
    {
        GUI.Label(new Rect(20, 150, 300, 24),
            $"Dome Integrity: {domeHealth.CurrentIntegrity:F0} / {domeHealth.MaxIntegrity:F0}"
            + (domeHealth.IsDestroyed ? "  💀 DESTROYED" : ""));
    }
}
