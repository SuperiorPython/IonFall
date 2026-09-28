using UnityEngine;

/// <summary>
/// TEMPORARY debug display — uses OnGUI so there's no Canvas/UI setup needed
/// just to verify the heat system works. Delete or replace this once real
/// UI is built in a later phase.
/// Attach to the same object as TurretShoot (TurretPivot), or anywhere in the scene.
/// </summary>
[RequireComponent(typeof(TurretShoot))]
public class HeatDebugDisplay : MonoBehaviour
{
    private TurretShoot turretShoot;
    private float displayCurrent;
    private float displayMax = 100f;
    private bool showOverheatWarning;

    private void Awake()
    {
        turretShoot = GetComponent<TurretShoot>();
    }

    private void OnEnable()
    {
        turretShoot.OnHeatChanged += HandleHeatChanged;
        turretShoot.OnOverheated += HandleOverheated;
        turretShoot.OnCooldownComplete += HandleCooldownComplete;
    }

    private void OnDisable()
    {
        turretShoot.OnHeatChanged -= HandleHeatChanged;
        turretShoot.OnOverheated -= HandleOverheated;
        turretShoot.OnCooldownComplete -= HandleCooldownComplete;
    }

    private void HandleHeatChanged(float current, float max)
    {
        displayCurrent = current;
        displayMax = max;
    }

    private void HandleOverheated()
    {
        showOverheatWarning = true;
    }

    private void HandleCooldownComplete()
    {
        showOverheatWarning = false;
    }

    private void OnGUI()
    {
        const int barWidth = 200;
        const int barHeight = 24;
        const int x = 20;
        const int y = 20;

        float pct = displayMax > 0f ? displayCurrent / displayMax : 0f;

        // Background
        GUI.Box(new Rect(x, y, barWidth, barHeight), GUIContent.none);

        // Fill — plain GUI.Box with a colored texture would need setup,
        // so this uses a simple colored Box via GUI.color instead (fine for debug purposes).
        var prevColor = GUI.color;
        GUI.color = showOverheatWarning ? Color.red : Color.Lerp(Color.green, Color.red, pct);
        GUI.Box(new Rect(x, y, barWidth * pct, barHeight), GUIContent.none);
        GUI.color = prevColor;

        // Label
        GUI.Label(new Rect(x, y + barHeight + 4, 250, 20),
            $"Heat: {displayCurrent:F0} / {displayMax:F0}" + (showOverheatWarning ? "  ⚠ OVERHEATED" : ""));
    }
}
