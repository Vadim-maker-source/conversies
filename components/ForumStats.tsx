interface ForumStatsProps {
    stats: {
      totalPosts: number
      totalComments: number
      totalUsers: number
      recentActivity: Array<{
        id: number
        title: string
        createdAt: Date
        author: {
          name: string | null
          username: string | null
        }
      }>
    }
  }
  
  export default function ForumStats({ stats }: ForumStatsProps) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Статистика */}
          <div className="md:col-span-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalPosts}</div>
                <div className="text-sm text-gray-600 mt-1">Постов</div>
              </div>
              
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.totalComments}</div>
                <div className="text-sm text-gray-600 mt-1">Комментариев</div>
              </div>
              
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.totalUsers}</div>
                <div className="text-sm text-gray-600 mt-1">Участников</div>
              </div>
            </div>
          </div>
  
          {/* Недавняя активность */}
          {/* <div>
            <h3 className="font-semibold mb-3 text-gray-700">Недавняя активность</h3>
            <div className="space-y-2">
              {stats.recentActivity.slice(0, 3).map((activity) => (
                <div key={activity.id} className="text-sm">
                  <div className="font-medium truncate">{activity.title}</div>
                  <div className="text-xs text-gray-500">
                    {activity.author.username || activity.author.name} •{' '}
                    {new Date(activity.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              ))}
            </div>
          </div> */}
        </div>
      </div>
    )
  }