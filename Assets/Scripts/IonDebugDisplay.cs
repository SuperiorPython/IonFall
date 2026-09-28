using UnityEngine;

/// <summary>
/// TEMPORARY debug display for ion count. Same throwaway pattern as the
/// heat and day/night displays — delete or replace once real UI exists.
/// Attach to the same object as IonManager.
/// </summary>
[RequireComponent(typeof(IonManager))]
public class IonDebugDisplay : MonoBehaviour
{
    private IonManager ionManager;

    private void Awake()
    {
        ionManager = GetComponent<IonManager>();
    }

    private void OnGUI()
    {
        GUI.Label(new Rect(20, 90, 300, 24), $"Ions: {ionManager.CurrentIons}");
    }
}
