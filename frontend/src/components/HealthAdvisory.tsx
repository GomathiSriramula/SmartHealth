interface AdvisoryItem {
    title: string;
    description: string;
    icon: React.ReactNode;
}

interface EmergencyContact {
    label: string;
    value: string;
}

const IconWrap: React.FC<{ children: React.ReactNode; bg: string; color: string }> = ({
    children,
    bg,
    color,
}) => (
    <div className={`p-3 ${bg} rounded-xl`}>
        <div className={color}>{children}</div>
    </div>
);

const HealthAdvisory: React.FC = () => {
    const advisories: AdvisoryItem[] = [
        {
            title: "Boil or Purify Drinking Water",
            description:
                "Boil water for at least 1 minute before drinking, or use certified purification tablets/filters. Avoid drinking directly from wells, rivers, or ponds during outbreak periods.",
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 3c-3 4-6 7.5-6 11a6 6 0 0012 0c0-3.5-3-7-6-11z"
                    ></path>
                </svg>
            ),
        },
        {
            title: "Wash Hands Frequently",
            description:
                "Wash hands with soap and clean water for at least 20 seconds, especially before eating, after using the toilet, and after handling waste or garbage.",
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 11V7a5 5 0 0110 0v4m-10 0h10m-10 0a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2"
                    ></path>
                </svg>
            ),
        },
        {
            title: "Store Food and Water Safely",
            description:
                "Keep drinking water in clean, covered containers. Store food away from insects and rodents, and avoid eating uncovered or stale food sold in the open.",
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    ></path>
                </svg>
            ),
        },
        {
            title: "Maintain Toilet and Waste Hygiene",
            description:
                "Use covered toilets/latrines and avoid open defecation. Dispose of household and animal waste away from drinking water sources.",
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H7a2 2 0 00-2 2v2"
                    ></path>
                </svg>
            ),
        },
        {
            title: "Recognize Early Warning Symptoms",
            description:
                "Watch for diarrhea, vomiting, fever, or dehydration in yourself or family members. Early reporting helps contain outbreaks before they spread further.",
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    ></path>
                </svg>
            ),
        },
        {
            title: "Seek Care Early",
            description:
                "Dehydration can become serious quickly, especially in children and the elderly. Use oral rehydration solution (ORS) and seek medical attention without delay if symptoms worsen.",
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                </svg>
            ),
        },
    ];

    const emergencyContacts: EmergencyContact[] = [
        { label: "National Health Helpline", value: "104" },
        { label: "Ambulance", value: "108" },
        { label: "Disaster Management Helpline", value: "1078" },
        { label: "District Health Office", value: "Contact your local PHC/CHC" },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Health Advisory</h1>
                <p className="text-gray-600">
                    Simple precautions to protect yourself and your community from water-borne diseases
                </p>
            </div>

            {/* Advisory Tips */}
            <div className="grid md:grid-cols-2 gap-4">
                {advisories.map((item, idx) => (
                    <div
                        key={idx}
                        className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-start space-x-4"
                    >
                        <IconWrap bg="bg-blue-50" color="text-blue-600">
                            {item.icon}
                        </IconWrap>
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                            <p className="text-sm text-gray-600">{item.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Emergency Contacts */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-4">
                    <IconWrap bg="bg-red-100" color="text-red-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            ></path>
                        </svg>
                    </IconWrap>
                    <h2 className="text-xl font-bold text-red-800">Emergency Contacts</h2>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                    {emergencyContacts.map((contact, idx) => (
                        <div
                            key={idx}
                            className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-red-100"
                        >
                            <span className="text-sm font-medium text-gray-700">{contact.label}</span>
                            <span className="text-sm font-bold text-red-700">{contact.value}</span>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-red-600 mt-4">
                    If symptoms are severe (persistent vomiting, high fever, signs of severe dehydration),
                    seek emergency medical care immediately rather than waiting.
                </p>
            </div>
        </div>
    );
};

export default HealthAdvisory;